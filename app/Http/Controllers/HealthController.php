<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Observability\HealthChecker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;

/**
 * Проверка живости приложения и его зависимостей (БД, Redis, очередь, Meilisearch).
 * Маршрут регистрируется вне группы middleware `web`: без сессии, кук и CSRF.
 *
 * 200 — приложение работает ({"status":"ok"} или {"status":"degraded"}, если не критичная зависимость недоступна);
 * 503 — недоступна БД ({"status":"down"}). deploy.sh ждёт 200 (curl -f), поэтому при 503 релиз откатывается.
 * Снаружи отдаётся только status; подробности (checks) — с 127.0.0.1 или по токену HEALTH_TOKEN
 * в заголовке X-Health-Token. Частота запросов ограничена (ThrottleHealth).
 */
final class HealthController extends Controller
{
    public function __invoke(Request $request, HealthChecker $checker): JsonResponse
    {
        $result = $checker->run();
        $status = $result['status'] === 'down' ? 503 : 200;

        if (! $this->mayShowDetails($request)) {
            return response()->json(['status' => $result['status']], $status);
        }

        return response()->json($result, $status);
    }

    private function mayShowDetails(Request $request): bool
    {
        // REMOTE_ADDR напрямую, а не ip(): X-Forwarded-For от доверенного прокси подделывается клиентом.
        if (in_array($request->server('REMOTE_ADDR'), ['127.0.0.1', '::1'], true)) {
            return true;
        }

        $token = Config::get('health.token');
        $given = $request->header('X-Health-Token');

        return is_string($token) && $token !== '' && is_string($given) && hash_equals($token, $given);
    }
}
