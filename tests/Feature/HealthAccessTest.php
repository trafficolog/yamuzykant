<?php

declare(strict_types=1);

use App\Http\Middleware\ThrottleHealth;
use App\Providers\TrustedProxiesServiceProvider;
use Illuminate\Contracts\Redis\Factory as RedisFactory;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\Support\FakeRedisConnection;
use Tests\Support\FakeRedisFactory;
use Tests\TestCase;

uses()->group(TestCase::NO_DATABASE_GROUP);

beforeEach(function () {
    Http::fake(fn () => Http::response(['status' => 'available']));
});

function useFakeRedisQueue(?string $payload = null): void
{
    config(['queue.default' => 'redis']);
    FakeRedisConnection::$listKeys = [];
    app()->instance(RedisFactory::class, new FakeRedisFactory(new FakeRedisConnection(false, $payload)));
}

it('снаружи /health отдаёт только status', function () {
    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9'])->getJson('/health')
        ->assertOk()
        ->assertExactJson(['status' => 'ok']);
});

it('снаружи при недоступной БД — 503 и только status', function () {
    config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => '/nonexistent/db.sqlite']);
    DB::purge();

    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9'])->getJson('/health')
        ->assertStatus(503)
        ->assertExactJson(['status' => 'down']);
});

it('с 127.0.0.1 подробности (checks) видны', function () {
    $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1'])->getJson('/health')
        ->assertOk()
        ->assertJsonPath('checks.database.status', 'ok');
});

it('подробности снаружи — только по токену из HEALTH_TOKEN', function () {
    config(['health.token' => 'secret-health-token']);
    $outside = $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9']);

    $outside->withHeader('X-Health-Token', 'wrong')->getJson('/health')->assertExactJson(['status' => 'ok']);
    $outside->withHeader('X-Health-Token', 'secret-health-token')->getJson('/health')
        ->assertJsonPath('checks.database.status', 'ok');
});

it('без заданного токена пустой X-Health-Token ничего не открывает', function () {
    config(['health.token' => null]);

    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9'])->withHeader('X-Health-Token', '')
        ->getJson('/health')->assertExactJson(['status' => 'ok']);
});

it('/health ограничен по частоте: сверх лимита — 429', function () {
    config(['health.throttle_per_minute' => 3]);
    $client = $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.77']);

    foreach (range(1, 3) as $_) {
        $client->getJson('/health')->assertOk();
    }
    $client->getJson('/health')->assertStatus(429);
});

it('очередь Redis: возвращённое задание (attempts > 0) со старым pushed_at не даёт degraded', function () {
    useFakeRedisQueue(json_encode(['pushed_at' => time() - 4000, 'attempts' => 2], JSON_THROW_ON_ERROR));

    $this->getJson('/health')
        ->assertOk()
        ->assertJsonPath('status', 'ok')
        ->assertJsonPath('checks.queue.status', 'ok');
});

it('очередь Redis: имена очередей берутся из конфига', function () {
    config(['login.mail_queue' => 'mail-x', 'queue.connections.redis.queue' => 'q-main']);
    useFakeRedisQueue();

    $this->getJson('/health')->assertOk();

    expect(FakeRedisConnection::$listKeys)->toContain('queues:mail-x', 'queues:q-main');
    expect(FakeRedisConnection::$listKeys)->not->toContain('queues:high');
});

it('сбой хранилища лимита пишется в журнал, но не чаще раза за интервал', function () {
    ThrottleHealth::resetFailureLog();
    $log = Log::spy();
    Cache::extend('exploding', fn () => throw new RuntimeException('store down'));
    config(['cache.stores.exploding' => ['driver' => 'exploding'], 'health.throttle_store' => 'exploding']);
    $client = $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9']);

    foreach (range(1, 3) as $_) {
        $client->getJson('/health')->assertOk();
    }

    $log->shouldHaveReceived('warning')->once();
});

it('X-Forwarded-For: 127.0.0.1 снаружи не открывает подробности', function () {
    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9'])
        ->withHeader('X-Forwarded-For', '127.0.0.1')
        ->withHeader('X-Real-IP', '127.0.0.1')
        ->getJson('/health')
        ->assertOk()
        ->assertExactJson(['status' => 'ok']);
});

it('X-Forwarded-For: 127.0.0.1 не открывает подробности и при доверии любому прокси', function () {
    TrustProxies::at('*');

    try {
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9'])
            ->withHeader('X-Forwarded-For', '127.0.0.1')
            ->getJson('/health')
            ->assertExactJson(['status' => 'ok']);
    } finally {
        TrustProxies::at(TrustedProxiesServiceProvider::PROXIES);
    }
});

it('/health не открывает сессию: в ответе нет Set-Cookie', function () {
    $response = $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9'])->getJson('/health')->assertOk();

    expect($response->headers->getCookies())->toBe([]);
    expect($response->headers->has('Set-Cookie'))->toBeFalse();
});

it('при недоступном хранилище лимита запрос пропускается без лимита, а не 500', function () {
    Cache::extend('exploding', fn () => throw new RuntimeException('store down'));
    config(['cache.stores.exploding' => ['driver' => 'exploding'], 'health.throttle_store' => 'exploding']);

    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9'])->getJson('/health')
        ->assertOk()
        ->assertExactJson(['status' => 'ok']);
});
