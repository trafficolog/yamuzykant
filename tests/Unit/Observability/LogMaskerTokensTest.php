<?php

declare(strict_types=1);

use App\Support\Observability\LogMasker;
use Tests\TestCase;

uses()->group(TestCase::NO_DATABASE_GROUP);

dataset('quoted tokens', [
    'JSON' => ['{"access_token":"abc123SECRET","expires_in":3600}', 'abc123SECRET'],
    'JSON с пробелами' => ['{"refresh_token": "abc123SECRET"}', 'abc123SECRET'],
    'в кавычках' => ['token="abc123SECRET"', 'abc123SECRET'],
    'в одинарных кавычках' => ["api_key='abc123SECRET'", 'abc123SECRET'],
    'экранированный JSON (в тексте исключения)' => ['Response: {\"access_token\":\"abc123SECRET\"}', 'abc123SECRET'],
    'без кавычек' => ['password=abc123SECRET&x=1', 'abc123SECRET'],
]);

it('маскирует токены в JSON и в кавычках', function (string $text, string $secret) {
    expect((new LogMasker)->mask($text))->not->toContain($secret);
})->with('quoted tokens');

it('не ломает остальную структуру JSON', function () {
    $masked = (new LogMasker)->mask('{"access_token":"abc123SECRET","expires_in":3600}');

    expect($masked)->toContain('expires_in');
    expect($masked)->toContain('3600');
});
