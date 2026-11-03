<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Listeners;

use App\Domain\Accounts\Actions\CompleteLogin;
use App\Domain\Accounts\Models\User;
use Illuminate\Auth\Events\Login;
use Illuminate\Contracts\Session\Session;

/**
 * При любом входе через guard `web` запоминает в сессии версию сессий пользователя.
 * Сессия без версии считается устаревшей (EnsureSessionIsCurrent), поэтому новый способ
 * входа не выпадет из «выйти на всех устройствах».
 */
final readonly class RememberSessionVersion
{
    public function __construct(private Session $session) {}

    public function handle(Login $event): void
    {
        if ($event->guard === 'web' && $event->user instanceof User) {
            $this->session->put(CompleteLogin::SESSION_VERSION_KEY, $event->user->session_version);
        }
    }
}
