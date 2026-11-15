<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Cache\RateLimiter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Лимит запросов к /health по адресу клиента. Счётчики — в хранилище `health.throttle_store`
 * (по умолчанию файловом), а не в Redis: при недоступном Redis /health должен отвечать, а не падать.
 * При сбое хранилища запрос пропускается без лимита; сбой пишется в журнал не чаще раза в FAILURE_LOG_INTERVAL секунд
 * на процесс, чтобы проверки каждые несколько секунд не засыпали журнал и Sentry.
 */
final class ThrottleHealth
{
    public const FAILURE_LOG_INTERVAL = 300;

    private static int $failureLoggedAt = 0;

    public static function resetFailureLog(): void
    {
        self::$failureLoggedAt = 0;
    }

    public function handle(Request $request, Closure $next): Response
    {
        try {
            $limiter = new RateLimiter(Cache::store(Config::string('health.throttle_store')));
            $key = 'health:'.(string) $request->server->get('REMOTE_ADDR', '');

            if ($limiter->tooManyAttempts($key, Config::integer('health.throttle_per_minute'))) {
                return response()->json(['status' => 'throttled'], 429, ['Retry-After' => (string) $limiter->availableIn($key)]);
            }

            $limiter->hit($key, 60);
        } catch (Throwable $e) {
            $this->logFailure($e);
        }

        return $next($request);
    }

    private function logFailure(Throwable $e): void
    {
        $now = time();

        if ($now - self::$failureLoggedAt < self::FAILURE_LOG_INTERVAL) {
            return;
        }

        self::$failureLoggedAt = $now;
        Log::warning('Хранилище лимита /health недоступно, запросы пропускаются без лимита', ['exception' => $e::class]);
    }
}
