<?php

declare(strict_types=1);

namespace App\Support\Observability;

use Illuminate\Contracts\Redis\Factory as RedisFactory;
use Illuminate\Redis\Connections\Connection;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Проверки зависимостей для /health.
 *
 * Критична только БД: без неё приложение не работает, ответ 503 (деплой откатывается).
 * Redis, очередь и Meilisearch — деградация: ответ 200 со status=degraded, чтобы выкатка не
 * откатывалась из-за вторичного сервиса; алерты на них — задача 6.4.3.
 * Проверка пропускается (skipped), если окружение не использует сервис (CI, тесты).
 * Тексты ошибок и параметры подключений в ответ не попадают.
 */
final class HealthChecker
{
    public const OK = 'ok';

    public const FAIL = 'fail';

    public const SKIPPED = 'skipped';

    /** Старейшее задание в очереди старше — очередь не обрабатывается (SPEC §9: «очередь > 5 мин»). */
    public const QUEUE_MAX_AGE = 300;

    /**
     * @return array{status: 'ok'|'degraded'|'down', checks: array<string, array<string, mixed>>}
     */
    public function run(): array
    {
        $checks = [
            'database' => $this->database(),
            'redis' => $this->redis(),
            'queue' => $this->queue(),
            'meilisearch' => $this->meilisearch(),
        ];

        $status = 'ok';
        if (in_array(self::FAIL, array_column($checks, 'status'), true)) {
            $status = 'degraded';
        }
        if ($checks['database']['status'] === self::FAIL) {
            $status = 'down';
        }

        return ['status' => $status, 'checks' => $checks];
    }

    /** @return array<string, mixed> */
    private function database(): array
    {
        try {
            DB::select('select 1');

            return ['status' => self::OK];
        } catch (Throwable) {
            return ['status' => self::FAIL];
        }
    }

    /** @return array<string, mixed> */
    private function redis(): array
    {
        if (! $this->usesRedis()) {
            return ['status' => self::SKIPPED];
        }

        try {
            $this->redisConnection(null)->ping();

            return ['status' => self::OK];
        } catch (Throwable) {
            return ['status' => self::FAIL];
        }
    }

    /** @return array<string, mixed> */
    private function queue(): array
    {
        $connection = Config::string('queue.default');
        $driver = Config::get("queue.connections.{$connection}.driver");

        try {
            $age = match ($driver) {
                'database' => $this->databaseQueueAge($connection),
                'redis' => $this->redisQueueAge($connection),
                default => null,
            };
        } catch (Throwable) {
            return ['status' => self::FAIL];
        }

        if ($age === null) {
            return ['status' => self::SKIPPED];
        }

        return [
            'status' => $age > self::QUEUE_MAX_AGE ? self::FAIL : self::OK,
            'oldest_age_seconds' => $age,
        ];
    }

    /** @return array<string, mixed> */
    private function meilisearch(): array
    {
        if (Config::get('scout.driver') !== 'meilisearch') {
            return ['status' => self::SKIPPED];
        }

        try {
            $host = rtrim(Config::string('scout.meilisearch.host'), '/');
            $ok = Http::timeout(1)->connectTimeout(1)->get($host.'/health')->successful();

            return ['status' => $ok ? self::OK : self::FAIL];
        } catch (Throwable) {
            return ['status' => self::FAIL];
        }
    }

    private function usesRedis(): bool
    {
        $cacheStore = Config::string('cache.default');
        $loginStore = Config::string('login.code_store', '');
        $sessionDriver = Config::get('session.driver');

        return Config::get('queue.default') === 'redis'
            || $sessionDriver === 'redis'
            || Config::get("cache.stores.{$cacheStore}.driver") === 'redis'
            || Config::get("cache.stores.{$loginStore}.driver") === 'redis';
    }

    private function redisConnection(?string $name): Connection
    {
        return app(RedisFactory::class)->connection($name);
    }

    private function databaseQueueAge(string $connection): int
    {
        $table = Config::string("queue.connections.{$connection}.table", 'jobs');
        $now = time();
        // Отложенные (available_at в будущем) и взятые в работу не считаются; возраст — от available_at.
        $oldest = DB::table($table)->whereNull('reserved_at')->where('available_at', '<=', $now)->min('available_at');

        return $oldest === null ? 0 : max(0, $now - (int) $oldest);
    }

    /**
     * Очереди, которые слушают воркеры: очередь писем с кодом входа и очередь соединения по умолчанию.
     *
     * @return list<string>
     */
    private function queueNames(string $connection): array
    {
        return array_values(array_unique([
            Config::string('login.mail_queue'),
            Config::string("queue.connections.{$connection}.queue", 'default'),
        ]));
    }

    /**
     * Возраст старейшего задания в Redis-очереди. Время постановки пишет Queue::createPayloadUsing
     * (AppServiceProvider) в поле pushed_at; задания без него (старый формат) считаются свежими.
     */
    private function redisQueueAge(string $connection): int
    {
        $redis = $this->redisConnection(Config::get("queue.connections.{$connection}.connection"));
        $age = 0;

        foreach ($this->queueNames($connection) as $queue) {
            $payloads = $redis->lrange("queues:{$queue}", 0, 19);

            foreach (is_array($payloads) ? $payloads : [] as $payload) {
                $job = is_string($payload) ? json_decode($payload, true) : null;
                // attempts > 0 — задание вернул release(): pushed_at у него старый, а ждёт оно по другой причине.
                if (! is_array($job) || (int) ($job['attempts'] ?? 0) > 0 || ! is_int($job['pushed_at'] ?? null)) {
                    continue;
                }
                $age = max($age, time() - $job['pushed_at']);

                break;
            }
        }

        return $age;
    }
}
