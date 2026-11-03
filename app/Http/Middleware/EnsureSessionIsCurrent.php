<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Accounts\Actions\CompleteLogin;
use App\Domain\Accounts\Actions\Logout;
use App\Domain\Accounts\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Завершает сессию, если пользователь нажал «выйти на всех устройствах» после входа в неё.
 */
final class EnsureSessionIsCurrent
{
    public function __construct(private readonly Logout $logout) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user instanceof User && $request->hasSession()) {
            $version = $request->session()->get(CompleteLogin::SESSION_VERSION_KEY);

            if ($version !== null && $version !== $user->session_version) {
                $this->logout->handle();
            }
        }

        return $next($request);
    }
}
