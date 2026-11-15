<?php

declare(strict_types=1);

namespace App\Http\Controllers\Notifications;

use App\Domain\Accounts\Models\User;
use App\Domain\Notifications\Enums\NotificationKind;
use App\Domain\Notifications\NotificationPreferences;
use Illuminate\Contracts\View\View;

/**
 * Отписка из письма (4.4.1): подписанная ссылка, вход не нужен, подпись проверяет middleware `signed`.
 * GET — страница с кнопкой, состояние не меняет (почтовые сканеры открывают ссылки); POST — отписывает:
 * его шлёт кнопка страницы и почтовый клиент «в один клик» (RFC 8058, без CSRF-токена).
 */
final class UnsubscribeController
{
    public function confirm(User $user, string $kind): View
    {
        $kind = NotificationKind::tryFrom($kind) ?? abort(404);

        return view('notifications.unsubscribed', ['kind' => $kind->value, 'done' => false]);
    }

    public function unsubscribe(User $user, string $kind): View
    {
        $kind = NotificationKind::tryFrom($kind) ?? abort(404);

        NotificationPreferences::update($user, [$kind->value => false]);

        return view('notifications.unsubscribed', ['kind' => $kind->value, 'done' => true]);
    }
}
