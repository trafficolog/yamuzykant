<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Actions;

use App\Domain\Accounts\Models\User;
use Illuminate\Contracts\Auth\Factory as AuthFactory;
use Illuminate\Contracts\Auth\StatefulGuard;
use Illuminate\Contracts\Session\Session;

final readonly class Logout
{
    public function __construct(
        private AuthFactory $auth,
        private Session $session,
    ) {}

    /**
     * Выход на этом устройстве.
     */
    public function handle(): void
    {
        $guard = $this->auth->guard('web');
        assert($guard instanceof StatefulGuard);

        $guard->logout();
        $this->session->invalidate();
        $this->session->regenerateToken();
    }

    /**
     * Выход на всех устройствах: версия сессий растёт, и все сессии со старой версией
     * завершаются при следующем запросе (EnsureSessionIsCurrent). Драйвер сессий не важен.
     */
    public function everywhere(User $user): void
    {
        $user->increment('session_version');

        $this->handle();
    }
}
