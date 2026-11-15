<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Accounts\Models\User;
use App\Domain\Notifications\Presence;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Отмечает авторизованного пользователя «в сети» (4.4.1): по этой метке письма о сообщениях не шлются. */
final class TrackPresence
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user instanceof User) {
            Presence::touch($user);
        }

        return $next($request);
    }
}
