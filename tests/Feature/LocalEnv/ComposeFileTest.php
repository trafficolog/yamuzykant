<?php

declare(strict_types=1);

use Symfony\Component\Yaml\Yaml;

/** Разбирает compose.yaml в массив. */
function localEnvCompose(): array
{
    return Yaml::parseFile(base_path('compose.yaml'));
}

/** Пары NAME => value из .env.example (без кавычек). */
function localEnvExample(): array
{
    $vars = [];
    foreach (file(base_path('.env.example'), FILE_IGNORE_NEW_LINES) as $line) {
        if (preg_match('/^([A-Z][A-Z0-9_]*)=(.*)$/', $line, $m) === 1) {
            $vars[$m[1]] = trim($m[2], '"');
        }
    }

    return $vars;
}

it('compose.yaml описывает pgsql 16, redis 7, meilisearch 1.x, mailpit и minio, у каждого есть healthcheck', function () {
    $services = localEnvCompose()['services'];

    expect(array_keys($services))->toContain('pgsql', 'redis', 'meilisearch', 'mailpit', 'minio');

    expect($services['pgsql']['image'])->toMatch('/^postgres:16/');
    expect($services['redis']['image'])->toMatch('/^redis:7/');
    expect($services['meilisearch']['image'])->toMatch('/^getmeili\/meilisearch:v1\./');
    expect($services['mailpit']['image'])->toMatch('/^axllent\/mailpit/');
    expect($services['minio']['image'])->toMatch('/^minio\/minio/');

    foreach (['pgsql', 'redis', 'meilisearch', 'mailpit', 'minio'] as $name) {
        expect($services[$name])->toHaveKey('healthcheck', "у сервиса {$name} нет healthcheck");
    }
});

it('значения по умолчанию в compose.yaml совпадают с .env.example, поэтому make up работает без правок .env', function () {
    $raw = file_get_contents(base_path('compose.yaml'));
    $env = localEnvExample();

    preg_match_all('/\$\{([A-Z][A-Z0-9_]*):-([^}]*)\}/', $raw, $matches, PREG_SET_ORDER);

    expect($matches)->not->toBeEmpty();

    foreach ($matches as [, $name, $default]) {
        expect($env)->toHaveKey($name, "переменная {$name} из compose.yaml не описана в .env.example");
        expect($env[$name])->toBe($default, "у {$name} в compose.yaml и .env.example разные значения");
    }
});

it('.env.example указывает приложение на сервисы compose', function () {
    $env = localEnvExample();

    expect($env['DB_CONNECTION'])->toBe('pgsql');
    expect($env['DB_HOST'])->toBe('127.0.0.1');
    expect($env['DB_PORT'])->toBe('5432');
    expect($env['DB_DATABASE'])->not->toBeEmpty();
    expect($env['REDIS_CLIENT'])->toBe('predis');
    expect($env['REDIS_HOST'])->toBe('127.0.0.1');
    expect($env['REDIS_PORT'])->toBe('6379');
    expect($env['MEILISEARCH_HOST'])->toBe('http://127.0.0.1:7700');
    expect(strlen($env['MEILISEARCH_KEY']))->toBeGreaterThanOrEqual(16);
    expect($env['MAIL_MAILER'])->toBe('smtp');
    expect($env['MAIL_HOST'])->toBe('127.0.0.1');
    expect($env['MAIL_PORT'])->toBe('1025');
    expect($env['FILESYSTEM_DISK'])->toBe('s3');
    expect($env['AWS_ENDPOINT'])->toBe('http://127.0.0.1:9000');
    expect($env['AWS_USE_PATH_STYLE_ENDPOINT'])->toBe('true');
    expect($env['AWS_BUCKET'])->not->toBeEmpty();
});

it('Makefile содержит цели up, down, fresh, e2e', function () {
    $makefile = file_get_contents(base_path('Makefile'));

    foreach (['up', 'down', 'fresh', 'e2e'] as $target) {
        expect($makefile)->toMatch('/^'.$target.':/m');
    }
});
