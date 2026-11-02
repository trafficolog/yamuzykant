<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

/**
 * Проверка живости приложения. Намеренно не трогает БД, кеш и сессию:
 * маршрут регистрируется вне группы middleware `web`.
 */
final class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json(['status' => 'ok']);
    }
}
