<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Служебные страницы `/_e2e/*` существуют только в local, testing и e2e. На stage и в production — 404 для всех,
 * включая гостя: стоит раньше `auth` (см. bootstrap/app.php), поэтому вместо редиректа на вход маршрут не виден.
 */
final class EnsureE2eEnvironment
{
    public const ENVIRONMENTS = ['local', 'testing', 'e2e'];

    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(app()->environment(self::ENVIRONMENTS), 404);

        return $next($request);
    }
}
