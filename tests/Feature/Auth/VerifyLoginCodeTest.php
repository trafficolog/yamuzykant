<?php

declare(strict_types=1);

use App\Domain\Accounts\EmailLogin\EmailAddress;
use App\Domain\Accounts\EmailLogin\LoginThrottle;
use App\Domain\Accounts\Exceptions\TooManyLoginAttempts;
use App\Domain\Accounts\Mail\LoginCodeMail;
use App\Domain\Accounts\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Support\Facades\Mail;

beforeEach(function () {
    Mail::fake();
    config(['login.code_fake' => null]);
});

it('верный код входит в существующий аккаунт и отмечает время входа', function () {
    $this->freezeSecond();
    $user = User::factory()->create(['email' => 'anna@example.com', 'last_login_at' => null]);
    $code = requestLoginCode('Anna@Example.com');
    $sessionBefore = session()->getId();

    $this->withCredentials()->withCookie((string) config('session.cookie'), $sessionBefore)
        ->postJson('/auth/email/verify', ['email' => 'ANNA@example.com', 'code' => $code])
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
        ->assertJsonPath('redirect', '/sell');
});

it('адрес возврата — только относительный путь внутри приложения', function (string $intended, string $expected) {
    User::factory()->create(['email' => 'anna@example.com']);
    $code = requestLoginCode('anna@example.com');

    $this->withSession(['url.intended' => $intended])
        ->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])
        ->assertOk()
        ->assertJsonPath('redirect', $expected);
})->with([
    'свой абсолютный URL' => ['http://localhost/sell?step=2', '/sell?step=2'],
    'относительный путь' => ['/account/favorites', '/account/favorites'],
    'чужой хост' => ['https://evil.example/phish', '/'],
    'свой хост, чужая схема' => ['ftp://localhost/sell', '/'],
    'protocol-relative' => ['//evil.example/phish', '/'],
    'обратный слэш' => ['/\evil.example', '/'],
    'javascript:' => ['javascript:alert(1)', '/'],
    'без слэша' => ['sell', '/'],
    'пусто' => ['', '/'],
]);

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
    $this->freezeSecond();
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
    $this->freezeSecond();
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

it('блок пары почта+IP не мешает другой паре: владелец входит тем же кодом со своего IP', function () {
    User::factory()->create(['email' => 'anna@example.com']);
    $code = requestLoginCode('anna@example.com', '203.0.113.10');

    foreach (range(1, 5) as $ignored) {
        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.66'])
            ->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => wrongLoginCode($code)]);
    }
    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.66'])
        ->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])
        ->assertStatus(429);

    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.10'])
        ->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])
        ->assertOk()
        ->assertJsonPath('status', 'authenticated');
});

it('потолок по почте: 31-я попытка после 30 неверных с разных IP → блок на 1 ч', function () {
    $this->freezeSecond();
    User::factory()->create(['email' => 'anna@example.com']);
    $code = requestLoginCode('anna@example.com');

    foreach (range(1, 29) as $i) {
        $this->withServerVariables(['REMOTE_ADDR' => "198.51.100.{$i}"])
            ->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => wrongLoginCode($code)])
            ->assertStatus(422);
    }
    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.30'])
        ->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => wrongLoginCode($code)])
        ->assertStatus(429);

    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.31'])
        ->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])
        ->assertStatus(429)
        ->assertJsonPath('message', 'Слишком много попыток. Повторите через 60 мин');
    $this->assertGuest();

    // После блока по почте код сгорел — нужен новый.
    $this->travel(61)->minutes();
    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.31'])
        ->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])
        ->assertStatus(422);
});

it('параллельные попытки пары: после 5 засчитанных попыток код не сравнивается', function () {
    User::factory()->create(['email' => 'anna@example.com']);
    $code = requestLoginCode('anna@example.com', '203.0.113.10');
    $throttle = app(LoginThrottle::class);
    $email = EmailAddress::from('anna@example.com');

    // 5 запросов «в полёте» уже прошли проверку блокировки и засчитали попытку, блок ещё не поставлен.
    foreach (range(1, 5) as $ignored) {
        $throttle->hitVerificationAttempt($email, '203.0.113.10');
    }

    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.10'])
        ->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])
        ->assertStatus(429);
    $this->assertGuest();
});

it('параллельные попытки с разных IP: после 30 засчитанных попыток на почту код не сравнивается', function () {
    User::factory()->create(['email' => 'anna@example.com']);
    $code = requestLoginCode('anna@example.com');
    $throttle = app(LoginThrottle::class);
    $email = EmailAddress::from('anna@example.com');

    foreach (range(1, 30) as $i) {
        $throttle->hitVerificationAttempt($email, "198.51.100.{$i}");
    }

    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.99'])
        ->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])
        ->assertStatus(429);
    $this->assertGuest();
});

it('4 засчитанные попытки в полёте не мешают 5-й с верным кодом', function () {
    User::factory()->create(['email' => 'anna@example.com']);
    $code = requestLoginCode('anna@example.com', '203.0.113.10');
    $throttle = app(LoginThrottle::class);

    foreach (range(1, 4) as $ignored) {
        $throttle->hitVerificationAttempt(EmailAddress::from('anna@example.com'), '203.0.113.10');
    }

    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.10'])
        ->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])
        ->assertOk();
});

it('постановка блока не обнуляет счётчик: запросы в полёте не получают второе окно', function () {
    User::factory()->create(['email' => 'anna@example.com']);
    $code = requestLoginCode('anna@example.com', '203.0.113.10');

    foreach (range(1, 5) as $ignored) {
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.10'])
            ->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => wrongLoginCode($code)]);
    }

    expect(fn () => app(LoginThrottle::class)->hitVerificationAttempt(EmailAddress::from('anna@example.com'), '203.0.113.10'))
        ->toThrow(TooManyLoginAttempts::class);
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
    // Вне testing Laravel включает проверку CSRF — здесь проверяется только код.
    $this->withoutMiddleware(ValidateCsrfToken::class);

    $this->postJson('/auth/email/code', ['email' => 'anna@example.com'])->assertStatus(202);

    /** @var LoginCodeMail $mail */
    $mail = Mail::queued(LoginCodeMail::class)->last();
    if ($mail->code === '123456') {
        $this->markTestSkipped('Случайный код совпал с LOGIN_CODE_FAKE');
    }

    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => '123456'])
        ->assertStatus(422);
    $this->assertGuest();
})->with(['local', 'stage', 'production']);
