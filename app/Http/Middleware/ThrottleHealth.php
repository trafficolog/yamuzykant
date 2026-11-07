<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Cache\RateLimiter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Symfony\Component\HttpFoundation\Response;

/**
 * Лимит запросов к /health по адресу клиента. Счётчики — в хранилище `health.throttle_store`
 * (по умолчанию файловом), а не в Redis: при недоступном Redis /health должен отвечать, а не падать.
 */
final class ThrottleHealth
{
    public function handle(Request $request, Closure $next): Response
    {
        $limiter = new RateLimiter(Cache::store(Config::string('health.throttle_store')));
        $key = 'health:'.(string) $request->server->get('REMOTE_ADDR', '');
        $max = Config::integer('health.throttle_per_minute');

        if ($limiter->tooManyAttempts($key, $max)) {
            return response()->json(['status' => 'throttled'], 429, ['Retry-After' => (string) $limiter->availableIn($key)]);
        }

        $limiter->hit($key, 60);

        return $next($request);
    }
}
