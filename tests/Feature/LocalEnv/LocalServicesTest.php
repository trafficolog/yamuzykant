<?php

declare(strict_types=1);

use Dotenv\Dotenv;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

// Тесты ходят в реальные сервисы из compose.yaml (нужен `make up`): без fake-дисков и заглушек.

/**
 * Значение переменной из файла .env. env() вне config/ не используем:
 * после `config:cache` он возвращает null (правило Larastan noEnvCallsOutsideOfConfig).
 */
function localEnvDotenvValue(string $key): ?string
{
    return Dotenv::parse(file_get_contents(base_path('.env')) ?: '')[$key] ?? null;
}

it('подключение к PostgreSQL 16 из .env работает', function () {
    $connection = DB::connection('pgsql');

    expect($connection->getDriverName())->toBe('pgsql');
    expect($connection->getDatabaseName())->toBe(config('database.connections.pgsql.database'));
    expect((int) $connection->selectOne('select 1 as ok')->ok)->toBe(1);
    expect($connection->selectOne('show server_version')->server_version)->toStartWith('16');
});

it('подключение к Redis 7 из .env работает', function () {
    $key = 'ymuzykant:infra-test:'.Str::random(8);

    expect((string) Redis::ping())->toBe('PONG');

    Redis::setex($key, 30, 'ok');
    expect(Redis::get($key))->toBe('ok');
    Redis::del($key);
});

it('S3-диск пишет и читает файлы в MinIO (не fake)', function () {
    $disk = Storage::disk('s3');
    $path = 'infra-test/'.Str::uuid().'.txt';

    expect(config('filesystems.disks.s3.endpoint'))->toBe(localEnvDotenvValue('AWS_ENDPOINT'));
    expect($disk->put($path, 'ymuzykant'))->toBeTrue();
    expect($disk->get($path))->toBe('ymuzykant');

    $disk->delete($path);
    expect($disk->exists($path))->toBeFalse();
});

it('Meilisearch отвечает на /health и принимает MEILISEARCH_KEY из .env', function () {
    $host = rtrim(localEnvDotenvValue('MEILISEARCH_HOST') ?? '', '/');
    $key = localEnvDotenvValue('MEILISEARCH_KEY') ?? '';

    $health = Http::get("{$host}/health");
    expect($health->status())->toBe(200);
    expect($health->json('status'))->toBe('available');

    // Мастер-ключ включён: без ключа доступ закрыт, с ключом открыт.
    expect(Http::get("{$host}/indexes")->status())->toBe(401);
    expect(Http::withToken($key)->get("{$host}/indexes")->status())->toBe(200);
});

it('письмо приложения через SMTP появляется в Mailpit', function () {
    $subject = 'infra-test-'.Str::uuid();

    Mail::mailer('smtp')->raw('проверка', fn ($message) => $message->to('test@example.com')->subject($subject));

    $messages = Http::get('http://127.0.0.1:8025/api/v1/messages')->json('messages', []);
    $subjects = collect(is_array($messages) ? $messages : [])->pluck('Subject');

    expect($subjects)->toContain($subject);
});
