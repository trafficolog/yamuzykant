<?php

declare(strict_types=1);

/**
 * Блоки сервисов из compose.yaml: имя => текст блока (строки с отступом).
 * YAML-парсер не подключаем: для проверки структуры хватает разбора по отступам.
 */
function localEnvComposeServices(): array
{
    $blocks = [];
    $inServices = false;
    $name = null;

    foreach (file(base_path('compose.yaml'), FILE_IGNORE_NEW_LINES) as $line) {
        if (preg_match('/^[a-z]/', $line) === 1) {
            $inServices = $line === 'services:';
            $name = null;

            continue;
        }

        if (! $inServices) {
            continue;
        }

        if (preg_match('/^  ([a-z][a-z-]*):$/', $line, $m) === 1) {
            $name = $m[1];
            $blocks[$name] = '';

            continue;
        }

        if ($name !== null) {
            $blocks[$name] .= $line."\n";
        }
    }

    return $blocks;
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
    $services = localEnvComposeServices();

    expect(array_keys($services))->toContain('pgsql', 'redis', 'meilisearch', 'mailpit', 'minio');

    $image = fn (string $name): string => preg_match('/^    image: (\S+)$/m', $services[$name], $m) === 1 ? $m[1] : '';

    expect($image('pgsql'))->toMatch('/^postgres:16/');
    expect($image('redis'))->toMatch('/^redis:7/');
    expect($image('meilisearch'))->toMatch('/^getmeili\/meilisearch:v1\./');
    expect($image('mailpit'))->toMatch('/^axllent\/mailpit/');
    foreach (['pgsql', 'redis', 'meilisearch', 'mailpit', 'minio'] as $name) {
        expect(str_contains($services[$name], "\n    healthcheck:\n"))->toBeTrue("у сервиса {$name} нет healthcheck");
    }
});

it('образы MinIO закреплены по digest из реестра Chainguard, а не по плавающему тегу', function () {
    $services = localEnvComposeServices();
    $image = fn (string $name): string => preg_match('/^    image: (\S+)$/m', $services[$name], $m) === 1 ? $m[1] : '';

    // minio/minio недоступен из Docker Hub на машине исполнителя (pull access denied), поэтому образы Chainguard.
    expect($image('minio'))->toMatch('/^chainguard\/minio@sha256:[0-9a-f]{64}$/');
    expect($image('minio-init'))->toMatch('/^chainguard\/minio-client@sha256:[0-9a-f]{64}$/');
});

it('ни один образ compose не использует :latest и не идёт без тега или digest', function () {
    foreach (localEnvComposeServices() as $name => $block) {
        preg_match('/^    image: (\S+)$/m', $block, $m);
        $image = $m[1] ?? '';

        expect($image)->not->toBe('', "у сервиса {$name} не указан image");
        expect($image)->not->toEndWith(':latest', "у сервиса {$name} плавающий тег latest");
        expect($image)->toMatch('/^[a-z0-9\/.-]+(:[\w.-]+|@sha256:[0-9a-f]{64})$/', "у сервиса {$name} образ без тега или digest");
    }
});

it('значения по умолчанию в compose.yaml совпадают с .env.example, поэтому make up работает без правок .env', function () {
    $raw = file_get_contents(base_path('compose.yaml'));
    $env = localEnvExample();

    preg_match_all('/\$\{([A-Z][A-Z0-9_]*):-([^}]*)\}/', $raw, $matches, PREG_SET_ORDER);

    expect($matches)->not->toBeEmpty();

    foreach ($matches as [, $name, $default]) {
        expect(array_key_exists($name, $env))->toBeTrue("переменная {$name} из compose.yaml не описана в .env.example");
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

it('minio-init вынесен в профиль init: обычный up его не запускает, а создание бакета идемпотентно', function () {
    $services = localEnvComposeServices();

    expect($services['minio-init'])->toContain('profiles: ["init"]');
    // В YAML команда записана списком: ["mb", "--ignore-existing", ...].
    expect($services['minio-init'])->toContain('"mb", "--ignore-existing"');
});

it('up поднимает сервисы без minio-init, а бакет создаётся отдельным запуском профиля init', function () {
    $makefile = file_get_contents(base_path('Makefile'));

    expect($makefile)->toContain("\tdocker compose up -d --wait\n");
    expect($makefile)->toContain("\tdocker compose --profile init run --rm minio-init\n");
});

it('README содержит те же команды запуска, что и Makefile, без make', function () {
    $readme = file_get_contents(base_path('README.md'));

    expect($readme)->toContain('docker compose up -d --wait');
    expect($readme)->toContain('docker compose --profile init run --rm minio-init');
});

it('Makefile содержит цели up, down, fresh, e2e', function () {
    $makefile = file_get_contents(base_path('Makefile'));

    foreach (['up', 'down', 'fresh', 'e2e'] as $target) {
        expect($makefile)->toMatch('/^'.$target.':/m');
    }
});
