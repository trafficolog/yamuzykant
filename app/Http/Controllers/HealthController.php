<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Observability\HealthChecker;
use Illuminate\Http\JsonResponse;

/**
 * Проверка живости приложения и его зависимостей (БД, Redis, очередь, Meilisearch).
 * Маршрут регистрируется вне группы middleware `web`: без сессии, кук и CSRF.
 *
 * 200 — приложение работает ({"status":"ok"} или {"status":"degraded"}, если не критичная зависимость недоступна);
 * 503 — недоступна БД ({"status":"down"}). deploy.sh ждёт 200 (curl -f), поэтому при 503 релиз откатывается.
 */
final class HealthController extends Controller
{
    public function __invoke(HealthChecker $checker): JsonResponse
    {
        $result = $checker->run();

        return response()->json($result, $result['status'] === 'down' ? 503 : 200);
    }
}
