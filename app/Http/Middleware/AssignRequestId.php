<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Str;
use Sentry\State\Scope;
use Symfony\Component\HttpFoundation\Response;

use function Sentry\configureScope;

/**
 * Присваивает запросу request_id: принимает входящий X-Request-Id (если он безопасен), иначе генерирует.
 * id попадает в Context Laravel — а значит в каждую запись журнала и в задания очереди — и в теги Sentry,
 * а также возвращается в заголовке ответа.
 */
final class AssignRequestId
{
    public const HEADER = 'X-Request-Id';

    public function handle(Request $request, Closure $next): Response
    {
        $incoming = $request->headers->get(self::HEADER);
        $id = is_string($incoming) && preg_match('/^[A-Za-z0-9\-]{8,64}$/', $incoming) === 1
            ? $incoming
            : (string) Str::uuid();

        $request->headers->set(self::HEADER, $id);
        Context::add('request_id', $id);

        if (function_exists('Sentry\configureScope')) {
            configureScope(static function (Scope $scope) use ($id): void {
                $scope->setTag('request_id', $id);
            });
        }

        $response = $next($request);
        $response->headers->set(self::HEADER, $id);

        return $response;
    }
}
