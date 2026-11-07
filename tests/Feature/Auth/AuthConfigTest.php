<?php

declare(strict_types=1);

it('брокера паролей пользователей нет: паролей у пользователей нет', function () {
    expect(config('auth.passwords'))->toBeNull()
        ->and(config('auth.defaults.passwords'))->toBeNull();
});

/**
 * Читает config/login.php при заданном APP_ENV: значения зависят от окружения, а конфиг приложения
 * в тесте уже собран для testing.
 *
 * @return array<string, mixed>
 */
function loginConfigFor(string $env): array
{
    $previous = $_ENV['APP_ENV'] ?? null;
    $_ENV['APP_ENV'] = $env;

    try {
        return require config_path('login.php');
    } finally {
        if ($previous === null) {
            unset($_ENV['APP_ENV']);
        } else {
            $_ENV['APP_ENV'] = $previous;
        }
    }
}

it('лимит кодов на IP — 20 в час, кроме окружения e2e: там все тесты входа идут с одного адреса', function (string $env, int $limit) {
    expect(loginConfigFor($env)['limits']['codes_per_ip'])->toBe($limit);
})->with([
    'production' => ['production', 20],
    'testing' => ['testing', 20],
    'local' => ['local', 20],
    'e2e' => ['e2e', 1000],
]);
