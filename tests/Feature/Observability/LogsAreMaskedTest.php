<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

beforeEach(function () {
    $this->logPath = sys_get_temp_dir().'/ym-log-'.uniqid().'.log';
    config([
        'logging.default' => 'single',
        'logging.channels.single.path' => $this->logPath,
        'logging.channels.single.level' => 'debug',
        'login.code_fake' => null,
    ]);
    Log::forgetChannel('single');
});

afterEach(function () {
    @unlink($this->logPath);
});

it('журнал пишется в JSON, одна запись — одна строка', function () {
    Log::info('Проверка формата', ['order' => 7]);
    Log::forgetChannel('single');

    $lines = file($this->logPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $record = json_decode((string) $lines[0], true, 512, JSON_THROW_ON_ERROR);

    expect($lines)->toHaveCount(1)
        ->and($record['message'])->toBe('Проверка формата')
        ->and($record['level_name'])->toBe('INFO');
});

it('в журнале нет e-mail и кода входа в открытом виде', function () {
    Mail::fake();
    User::factory()->create(['email' => 'anna@example.com']);

    $code = requestLoginCode('anna@example.com');
    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => wrongLoginCode($code)]);
    Log::warning('Не удалось войти anna@example.com', ['email' => 'anna@example.com', 'code' => $code]);
    Log::error('Сбой', ['exception' => new RuntimeException("Письмо для anna@example.com, код: {$code}")]);
    Log::forgetChannel('single');

    $raw = (string) file_get_contents($this->logPath);

    expect($raw)->not->toBe('')
        ->and($raw)->not->toContain('anna@example.com')
        ->and($raw)->not->toContain($code);
});
