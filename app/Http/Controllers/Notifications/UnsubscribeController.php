<?php

declare(strict_types=1);

namespace App\Http\Controllers\Notifications;

use App\Domain\Accounts\Models\User;
use App\Domain\Notifications\Enums\NotificationKind;
use App\Domain\Notifications\NotificationPreferences;
use Illuminate\Contracts\View\View;

/**
 * Отписка из письма в один клик (4.4.1): подписанная ссылка, вход не нужен. GET — переход по ссылке,
 * POST — «отписаться» в самом почтовом клиенте (RFC 8058, без CSRF-токена). Подпись проверяет middleware `signed`.
 */
final class UnsubscribeController
{
    public function __invoke(User $user, string $kind): View
    {
        $kind = NotificationKind::tryFrom($kind) ?? abort(404);

        NotificationPreferences::update($user, [$kind->value => false]);

        return view('notifications.unsubscribed', ['kind' => $kind->value]);
    }
}
