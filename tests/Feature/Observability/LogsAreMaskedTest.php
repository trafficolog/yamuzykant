<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

it('журнал пишется в JSON, одна запись — одна строка', function () {
    $path = useTempJsonLog();

    Log::info('Проверка формата', ['order' => 7]);

    $lines = readLogLines($path);
    $record = json_decode($lines[0] ?? '', true, 512, JSON_THROW_ON_ERROR);

    expect($lines)->toHaveCount(1);
    expect($record['message'])->toBe('Проверка формата');
    expect($record['level_name'])->toBe('INFO');
});

it('в журнале нет e-mail и кода входа в открытом виде', function () {
    config(['login.code_fake' => null]);
    $path = useTempJsonLog();
    Mail::fake();
    User::factory()->create(['email' => 'anna@example.com']);

    $code = requestLoginCode('anna@example.com');
    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => wrongLoginCode($code)]);
    Log::warning('Не удалось войти anna@example.com', ['email' => 'anna@example.com', 'code' => $code]);
    Log::error('Сбой', ['exception' => new RuntimeException("Письмо для anna@example.com, код: {$code}")]);

    $raw = implode("\n", readLogLines($path));

    expect($raw)->not->toBe('');
    expect($raw)->not->toContain('anna@example.com');
    expect($raw)->not->toContain($code);
});
