<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\AtomicLimiter;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Symfony\Component\HttpFoundation\Response;

/**
 * Лимит отправки сообщений на пользователя: `messaging.send_per_minute` в минуту, новые беседы — в том же лимите
 * (ARCHITECTURE §7). Счётчик атомарный (AtomicLimiter): стандартный `throttle:` проверяет и увеличивает раздельно.
 */
final class ThrottleMessages
{
    public function __construct(private readonly AtomicLimiter $limiter) {}

    public function handle(Request $request, Closure $next): Response
    {
        $key = 'messages:'.($request->user()?->getAuthIdentifier() ?? $request->ip());

        if (! $this->limiter->hit($key, Config::integer('messaging.send_per_minute'), 60)) {
            return new JsonResponse(
                ['message' => __('messaging.errors.throttled')],
                429,
                ['Retry-After' => (string) max(1, $this->limiter->availableIn($key))],
            );
        }

        return $next($request);
    }
}
