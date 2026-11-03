<?php

declare(strict_types=1);

use App\Domain\Accounts\Mail\LoginCodeMail;
use App\Domain\Accounts\Models\User;
use Illuminate\Mail\SendQueuedMailable;
use Illuminate\Mail\Transport\ArrayTransport;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Mockery\MockInterface;
use Symfony\Component\Mime\Email;

/**
 * Проверяет, что ни один вызов логгера не содержит строку.
 */
function assertNotLogged(MockInterface $log, string $needle): void
{
    $methods = ['emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug', 'log', 'write', 'withContext', 'shareContext'];

    foreach ($methods as $method) {
        $log->shouldNotHaveReceived($method, function (mixed ...$args) use ($needle): bool {
            return str_contains(print_r($args, true), $needle);
        });
    }
}

beforeEach(function () {
    config(['login.code_fake' => null]);
});

it('код не попадает в логи и отчёты об ошибках (Log::spy) на всём пути входа', function () {
    $log = Log::spy();
    Exceptions::fake();
    Mail::fake();
    User::factory()->create(['email' => 'anna@example.com']);

    $code = requestLoginCode('anna@example.com');
    $wrong = wrongLoginCode($code);
    foreach (range(1, 2) as $ignored) {
        $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $wrong]);
    }
    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])->assertOk();

    // Логгер вызывался (событие отправки кода), но ни разу — с кодом.
    $log->shouldHaveReceived('info')->withArgs(fn (string $message) => $message === 'auth.login_code.sent');
    assertNotLogged($log, $code);
    assertNotLogged($log, $wrong);
    Exceptions::assertNothingReported();
});

it('код не попадает в логи при реальной отправке письма через очередь', function () {
    $log = Log::spy();
    config(['mail.default' => 'array']);

    $this->postJson('/auth/email/code', ['email' => 'anna@example.com'])->assertStatus(202);

    $transport = Mail::mailer('array')->getSymfonyTransport();
    if (! $transport instanceof ArrayTransport) {
        throw new LogicException('Ожидался array-транспорт почты');
    }
    $sent = $transport->messages();
    $message = $sent->first()?->getOriginalMessage();
    $body = $message instanceof Email ? (string) $message->getTextBody() : '';

    expect($sent)->toHaveCount(1)
        ->and(preg_match('/\b(\d{6})\b/', $body, $m))->toBe(1);

    assertNotLogged($log, $m[1] ?? '');
});

it('код не попадает в ответы API', function () {
    Mail::fake();
    User::factory()->create(['email' => 'anna@example.com']);

    $send = $this->postJson('/auth/email/code', ['email' => 'anna@example.com']);
    /** @var LoginCodeMail $mail */
    $mail = Mail::queued(LoginCodeMail::class)->last();
    $code = $mail->code;

    $wrong = $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => wrongLoginCode($code)]);
    $ok = $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code]);

    foreach ([$send, $wrong, $ok] as $response) {
        expect($response->getContent())->not->toContain($code)
            ->and((string) json_encode($response->headers->all()))->not->toContain($code);
    }
    expect($wrong->getContent())->not->toContain(wrongLoginCode($code));
});

it('код не сохраняется в сессии как old input при ошибке формы', function () {
    $this->from('/')
        ->post('/auth/email/verify', ['email' => 'anna@example.com', 'code' => '12345'])
        ->assertRedirect('/');

    expect(session()->getOldInput('code'))->toBeNull()
        ->and(session()->getOldInput('email'))->toBe('anna@example.com');
});

it('в задании очереди код зашифрован', function () {
    Queue::fake();

    $this->postJson('/auth/email/code', ['email' => 'anna@example.com'])->assertStatus(202);

    Queue::assertPushedOn('high', SendQueuedMailable::class, function ($job) {
        return $job->shouldBeEncrypted === true;
    });
});
