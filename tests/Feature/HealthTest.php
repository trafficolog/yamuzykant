<?php

declare(strict_types=1);

use Illuminate\Contracts\Redis\Factory as RedisFactory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\Support\FakeRedisConnection;
use Tests\Support\FakeRedisFactory;
use Tests\TestCase;

// /health работает и при пустой БД без миграций: группа no-database отключает RefreshDatabase (см. Tests\TestCase).
uses()->group(TestCase::NO_DATABASE_GROUP);

/**
 * Ответ Meilisearch на /health: HTTP-код, который вернёт подмена.
 */
function meilisearchAnswers(?int $status = null): int
{
    static $current = 200;

    if ($status !== null) {
        $current = $status;
    }

    return $current;
}

function fakeRedis(bool $pingFails = false, ?string $oldestPayload = null): void
{
    app()->instance(RedisFactory::class, new FakeRedisFactory(new FakeRedisConnection($pingFails, $oldestPayload)));
}

beforeEach(function () {
    meilisearchAnswers(200);
    Http::fake(fn () => Http::response(['status' => 'available'], meilisearchAnswers()));
});

it('/health отвечает 200 и status ok, когда все проверки пройдены или пропущены', function () {
    $this->getJson('/health')
        ->assertOk()
        ->assertJsonPath('status', 'ok')
        ->assertJsonPath('checks.database.status', 'ok')
        ->assertJsonPath('checks.redis.status', 'skipped')
        ->assertJsonPath('checks.queue.status', 'skipped')
        ->assertJsonPath('checks.meilisearch.status', 'ok');
});

it('/health отвечает быстрее 50 мс', function () {
    $this->getJson('/health')->assertOk(); // прогрев: загрузка маршрутов и контейнера

    $durations = [];
    foreach (range(1, 5) as $_) {
        $start = hrtime(true);
        $this->getJson('/health')->assertOk();
        $durations[] = (hrtime(true) - $start) / 1_000_000;
    }

    expect(min($durations))->toBeLessThan(50.0);
});

it('/health отвечает 503, если БД недоступна', function () {
    config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => '/nonexistent/db.sqlite']);
    DB::purge();

    $this->getJson('/health')
        ->assertStatus(503)
        ->assertJsonPath('status', 'down')
        ->assertJsonPath('checks.database.status', 'fail');
});

it('/health не раскрывает текст ошибок и параметры подключения', function () {
    config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => '/nonexistent/db.sqlite']);
    DB::purge();

    $body = $this->getJson('/health')->getContent();

    expect($body)->not->toContain('nonexistent');
    expect($body)->not->toContain('SQLSTATE');
});

it('недоступный Meilisearch — 200 и status degraded', function () {
    meilisearchAnswers(500);

    $this->getJson('/health')
        ->assertOk()
        ->assertJsonPath('status', 'degraded')
        ->assertJsonPath('checks.meilisearch.status', 'fail');
});

it('Meilisearch не проверяется, если Scout работает не на нём', function () {
    config(['scout.driver' => 'null']);

    $this->getJson('/health')->assertOk()->assertJsonPath('checks.meilisearch.status', 'skipped');
});

it('недоступный Redis — 200 и status degraded', function () {
    config(['queue.default' => 'redis']);
    fakeRedis(pingFails: true);

    $this->getJson('/health')
        ->assertOk()
        ->assertJsonPath('status', 'degraded')
        ->assertJsonPath('checks.redis.status', 'fail');
});

it('очередь Redis: старейшее задание старше 5 минут — degraded, свежее — ok', function () {
    config(['queue.default' => 'redis']);

    fakeRedis(oldestPayload: json_encode(['pushed_at' => time() - 400], JSON_THROW_ON_ERROR));
    $this->getJson('/health')
        ->assertOk()
        ->assertJsonPath('status', 'degraded')
        ->assertJsonPath('checks.queue.status', 'fail');

    fakeRedis(oldestPayload: json_encode(['pushed_at' => time() - 10], JSON_THROW_ON_ERROR));
    $this->getJson('/health')
        ->assertOk()
        ->assertJsonPath('status', 'ok')
        ->assertJsonPath('checks.queue.status', 'ok');

    fakeRedis(oldestPayload: null);
    $this->getJson('/health')->assertJsonPath('checks.queue.oldest_age_seconds', 0);
});
