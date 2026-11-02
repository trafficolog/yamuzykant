<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

// Тесты ходят в реальные сервисы из compose.yaml (нужен `make up`): без fake-дисков и заглушек.

it('подключение к PostgreSQL 16 из .env работает', function () {
    $connection = DB::connection('pgsql');

    expect($connection->getDriverName())->toBe('pgsql');
    expect($connection->getDatabaseName())->toBe(env('DB_DATABASE'));
    expect((int) $connection->selectOne('select 1 as ok')->ok)->toBe(1);
    expect($connection->selectOne('show server_version')->server_version)->toStartWith('16');
});

it('подключение к Redis 7 из .env работает', function () {
    $key = 'ymuzykant:infra-test:'.Str::random(8);

    expect((string) Redis::ping())->toBe('PONG');

    Redis::set($key, 'ok', 'EX', 30);
    expect(Redis::get($key))->toBe('ok');
    Redis::del($key);
});

it('S3-диск пишет и читает файлы в MinIO (не fake)', function () {
    $disk = Storage::disk('s3');
    $path = 'infra-test/'.Str::uuid().'.txt';

    expect(config('filesystems.disks.s3.endpoint'))->toBe(env('AWS_ENDPOINT'));
    expect($disk->put($path, 'ymuzykant'))->toBeTrue();
    expect($disk->get($path))->toBe('ymuzykant');

    $disk->delete($path);
    expect($disk->exists($path))->toBeFalse();
});

it('Meilisearch отвечает на /health и принимает MEILISEARCH_KEY из .env', function () {
    $host = rtrim((string) env('MEILISEARCH_HOST'), '/');
    $key = (string) env('MEILISEARCH_KEY');

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

    $subjects = collect(Http::get('http://127.0.0.1:8025/api/v1/messages')->json('messages', []))->pluck('Subject');

    expect($subjects)->toContain($subject);
});
