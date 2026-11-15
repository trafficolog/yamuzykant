<?php

declare(strict_types=1);

namespace App\Domain\Notifications\Enums;

use App\Domain\Accounts\Models\User;
use Illuminate\Support\Facades\URL;

/**
 * Вид письма-уведомления, который пользователь может выключить в «Кабинет → Профиль» (UC-A2, N1).
 * Служебные письма — код входа и подобные — сюда не входят: они уходят всегда.
 * В G1 есть только письма о сообщениях; остальные виды добавляют задачи G2 (4.4.x).
 */
enum NotificationKind: string
{
    case NewMessage = 'new_message';

    public function enabledByDefault(): bool
    {
        return true;
    }

    /** Подписанная постоянная ссылка отписки из письма (4.4.1): один клик, без входа. */
    public function unsubscribeUrl(User $user): string
    {
        return URL::signedRoute('notifications.unsubscribe', ['user' => $user->id, 'kind' => $this->value]);
    }
}
