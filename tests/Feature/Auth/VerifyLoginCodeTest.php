<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use Illuminate\Support\Facades\Mail;

beforeEach(function () {
    Mail::fake();
    config(['login.code_fake' => null]);
});

it('верный код входит в существующий аккаунт и отмечает время входа', function () {
    $this->freezeTime();
    $user = User::factory()->create(['email' => 'anna@example.com', 'last_login_at' => null]);
    $code = requestLoginCode('Anna@Example.com');
    $sessionBefore = session()->getId();

    $this->postJson('/auth/email/verify', ['email' => 'ANNA@example.com', 'code' => $code])
        ->assertOk()
        ->assertExactJson(['status' => 'authenticated', 'redirect' => '/']);

    $this->assertAuthenticatedAs($user);
    expect($user->fresh()?->last_login_at?->equalTo(now()))->toBeTrue()
        ->and(session()->getId())->not->toBe($sessionBefore);
});

it('после входа возвращает к прерванному действию', function () {
    User::factory()->create(['email' => 'anna@example.com']);
    $code = requestLoginCode('anna@example.com');

    $this->withSession(['url.intended' => 'http://localhost/sell'])
        ->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])
        ->assertOk()
        ->assertJsonPath('redirect', 'http://localhost/sell');
});

it('код одноразовый', function () {
    User::factory()->create(['email' => 'anna@example.com']);
    $code = requestLoginCode('anna@example.com');

    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])->assertOk();
    auth()->logout();

    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])
        ->assertStatus(422);
});

it('новая почта: аккаунт не создаётся, в сессии — «нужна регистрация»', function () {
    $code = requestLoginCode('boris@example.com');

    $this->postJson('/auth/email/verify', ['email' => 'boris@example.com', 'code' => $code])
        ->assertOk()
        ->assertExactJson(['status' => 'registration_required', 'name' => null]);

    $this->assertGuest();
    expect(User::query()->count())->toBe(0)
        ->and(session('auth.pending_registration.email'))->toBe('boris@example.com');
});

it('неверный код → 422 с текстом ошибки', function () {
    $code = requestLoginCode('anna@example.com');

    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => wrongLoginCode($code)])
        ->assertStatus(422)
        ->assertJsonPath('errors.code.0', 'Неверный или устаревший код. Проверьте письмо или запросите новый код');

    $this->assertGuest();
});

it('без запрошенного кода → 422', function () {
    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => '123456'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['code']);
});

it('истёкший код → 422', function () {
    $this->freezeTime();
    User::factory()->create(['email' => 'anna@example.com']);
    $code = requestLoginCode('anna@example.com');

    $this->travel(601)->seconds();

    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])
        ->assertStatus(422);
    $this->assertGuest();
});

it('проверяет формат запроса', function (array $payload, string $field) {
    $this->postJson('/auth/email/verify', $payload)
        ->assertStatus(422)
        ->assertJsonValidationErrors([$field]);
})->with([
    'нет кода' => [['email' => 'anna@example.com'], 'code'],
    '5 цифр' => [['email' => 'anna@example.com', 'code' => '12345'], 'code'],
    'буквы' => [['email' => 'anna@example.com', 'code' => '12a456'], 'code'],
    'нет почты' => [['code' => '123456'], 'email'],
]);

it('5 неверных кодов → блок 15 мин даже с верным кодом', function () {
    $this->freezeTime();
    User::factory()->create(['email' => 'anna@example.com']);
    $code = requestLoginCode('anna@example.com');
    $wrong = wrongLoginCode($code);

    foreach (range(1, 4) as $ignored) {
        $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $wrong])
            ->assertStatus(422);
    }

    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $wrong])
        ->assertStatus(429)
        ->assertJsonPath('message', 'Слишком много попыток. Повторите через 15 мин');

    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])
        ->assertStatus(429)
        ->assertHeader('Retry-After', '900');
    $this->assertGuest();

    $this->travel(14)->minutes();
    $fresh = requestLoginCode('anna@example.com');
    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $fresh])
        ->assertStatus(429)
        ->assertJsonPath('message', 'Слишком много попыток. Повторите через 1 мин');
    $this->assertGuest();

    $this->travel(61)->seconds();
    $fresh = requestLoginCode('anna@example.com');
    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $fresh])
        ->assertOk()
        ->assertJsonPath('status', 'authenticated');
});

it('после блокировки прежний код больше не действует', function () {
    $this->freezeTime();
    User::factory()->create(['email' => 'anna@example.com']);
    $code = requestLoginCode('anna@example.com');

    foreach (range(1, 5) as $ignored) {
        $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => wrongLoginCode($code)]);
    }

    $this->travel(16)->minutes();

    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])
        ->assertStatus(422);
});

it('верный код сбрасывает счётчик неверных попыток', function () {
    User::factory()->create(['email' => 'anna@example.com']);

    $code = requestLoginCode('anna@example.com');
    foreach (range(1, 4) as $ignored) {
        $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => wrongLoginCode($code)])
            ->assertStatus(422);
    }
    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])->assertOk();
    auth()->logout();

    $code = requestLoginCode('anna@example.com');
    foreach (range(1, 4) as $ignored) {
        $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => wrongLoginCode($code)])
            ->assertStatus(422);
    }
    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])->assertOk();
});

it('LOGIN_CODE_FAKE работает в окружении testing', function () {
    config(['login.code_fake' => '123456']);
    User::factory()->create(['email' => 'anna@example.com']);

    $this->postJson('/auth/email/code', ['email' => 'anna@example.com'])->assertStatus(202);
    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => '123456'])
        ->assertOk()
        ->assertJsonPath('status', 'authenticated');
});

it('LOGIN_CODE_FAKE не открывает вход при APP_ENV :dataset', function (string $env) {
    config(['login.code_fake' => '123456']);
    User::factory()->create(['email' => 'anna@example.com']);
    app()['env'] = $env;

    $this->postJson('/auth/email/code', ['email' => 'anna@example.com'])->assertStatus(202);

    /** @var App\Domain\Accounts\Mail\LoginCodeMail $mail */
    $mail = Mail::queued(App\Domain\Accounts\Mail\LoginCodeMail::class)->last();
    if ($mail->code === '123456') {
        $this->markTestSkipped('Случайный код совпал с LOGIN_CODE_FAKE');
    }

    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => '123456'])
        ->assertStatus(422);
    $this->assertGuest();
})->with(['local', 'stage', 'production']);
