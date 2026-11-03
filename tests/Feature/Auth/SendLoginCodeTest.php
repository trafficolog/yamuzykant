<?php

declare(strict_types=1);

use App\Domain\Accounts\EmailLogin\EmailAddress;
use App\Domain\Accounts\Mail\LoginCodeMail;
use App\Domain\Accounts\Models\User;
use Illuminate\Cache\RateLimiter;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;

beforeEach(function () {
    Mail::fake();
    config(['login.code_fake' => null]);
});

it('ставит письмо с кодом в очередь с высоким приоритетом', function () {
    $this->postJson('/auth/email/code', ['email' => 'Anna@Example.com'])
        ->assertStatus(202)
        ->assertExactJson(['status' => 'code_sent', 'expires_in' => 600]);

    Mail::assertQueued(LoginCodeMail::class, function (LoginCodeMail $mail) {
        return $mail->hasTo('anna@example.com')
            && $mail->queue === 'high'
            && preg_match('/^\d{6}$/', $mail->code) === 1;
    });
    Mail::assertNothingSent();
});

it('письмо в очереди зашифровано и рендерится Markdown-шаблоном с кодом', function () {
    $mail = new LoginCodeMail('048213');

    expect($mail)->toBeInstanceOf(ShouldQueue::class)
        ->and($mail)->toBeInstanceOf(ShouldBeEncrypted::class);

    $mail->assertHasSubject('Код для входа на ЯМузыканте');
    $mail->assertSeeInHtml('048213');
    $mail->assertSeeInText('048213');
    $mail->assertSeeInText('10 мин');
    $mail->assertDontSeeInText('All rights reserved');
});

it('ответ одинаковый для существующей и новой почты', function () {
    User::factory()->create(['email' => 'anna@example.com']);

    $existing = $this->postJson('/auth/email/code', ['email' => 'anna@example.com']);
    $new = $this->postJson('/auth/email/code', ['email' => 'boris@example.com']);

    expect($existing->status())->toBe($new->status())
        ->and($existing->json())->toBe($new->json())
        ->and(array_keys($existing->headers->all()))->toEqualCanonicalizing(array_keys($new->headers->all()));
    Mail::assertQueued(LoginCodeMail::class, 2);
});

it('проверяет формат почты', function (mixed $email) {
    $this->postJson('/auth/email/code', ['email' => $email])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['email']);

    Mail::assertNothingQueued();
})->with([
    'пусто' => '',
    'без собаки' => 'anna.example.com',
    'не строка' => [['a@b.ru']],
]);

it('6-й код за час на один адрес → 429 «Слишком много попыток. Повторите через N мин»', function () {
    $this->freezeTime();

    foreach (range(1, 5) as $i) {
        $this->withServerVariables(['REMOTE_ADDR' => "203.0.113.{$i}"])
            ->postJson('/auth/email/code', ['email' => 'anna@example.com'])
            ->assertStatus(202);
    }

    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.99'])
        ->postJson('/auth/email/code', ['email' => 'ANNA@example.com'])
        ->assertStatus(429)
        ->assertHeader('Retry-After', '3600')
        ->assertExactJson([
            'message' => 'Слишком много попыток. Повторите через 60 мин',
            'retry_after' => 3600,
        ]);

    Mail::assertQueued(LoginCodeMail::class, 5);
});

it('N в сообщении — оставшиеся минуты с округлением вверх', function () {
    $this->freezeTime();
    foreach (range(1, 5) as $ignored) {
        $this->postJson('/auth/email/code', ['email' => 'anna@example.com'])->assertStatus(202);
    }

    $this->travel(40)->minutes();
    $this->travel(30)->seconds();

    $this->postJson('/auth/email/code', ['email' => 'anna@example.com'])
        ->assertStatus(429)
        ->assertJsonPath('message', 'Слишком много попыток. Повторите через 20 мин');
});

it('через час лимит по адресу сбрасывается', function () {
    $this->freezeTime();
    foreach (range(1, 5) as $ignored) {
        $this->postJson('/auth/email/code', ['email' => 'anna@example.com'])->assertStatus(202);
    }

    $this->travel(61)->minutes();

    $this->postJson('/auth/email/code', ['email' => 'anna@example.com'])->assertStatus(202);
});

it('попытка засчитывается до проверки лимита: параллельная пачка не проходит дальше 5', function () {
    foreach (range(1, 6) as $ignored) {
        $this->postJson('/auth/email/code', ['email' => 'anna@example.com']);
    }

    // Счётчик увеличивается атомарно (INCR) раньше сравнения с лимитом: 6-й запрос тоже засчитан,
    // поэтому параллельные запросы не могут одновременно увидеть «ещё есть попытки».
    $limiter = new RateLimiter(Cache::store('array'));
    expect($limiter->attempts('login:codes:email:'.EmailAddress::from('anna@example.com')->key()))->toBe(6);
    Mail::assertQueued(LoginCodeMail::class, 5);
});

it('лимит по адресу не мешает другим адресам', function () {
    foreach (range(1, 5) as $ignored) {
        $this->postJson('/auth/email/code', ['email' => 'anna@example.com'])->assertStatus(202);
    }

    $this->postJson('/auth/email/code', ['email' => 'boris@example.com'])->assertStatus(202);
});

it('21-й код за час с одного IP → 429', function () {
    $this->freezeTime();
    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.7']);

    foreach (range(1, 20) as $i) {
        $this->postJson('/auth/email/code', ['email' => "user{$i}@example.com"])->assertStatus(202);
    }

    $this->postJson('/auth/email/code', ['email' => 'user21@example.com'])
        ->assertStatus(429)
        ->assertJsonPath('message', 'Слишком много попыток. Повторите через 60 мин');

    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.8'])
        ->postJson('/auth/email/code', ['email' => 'user21@example.com'])
        ->assertStatus(202);

    Mail::assertQueued(LoginCodeMail::class, 21);
});

it('новый код отменяет прежний', function () {
    $first = requestLoginCode('anna@example.com');
    $second = requestLoginCode('anna@example.com');

    if ($first === $second) {
        $this->markTestSkipped('Совпали два случайных кода подряд');
    }

    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $first])
        ->assertStatus(422);
    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $second])
        ->assertOk();
});

it('вошедшему пользователю код не отправляется', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/auth/email/code', ['email' => 'anna@example.com'])
        ->assertRedirect();

    Mail::assertNothingQueued();
});
