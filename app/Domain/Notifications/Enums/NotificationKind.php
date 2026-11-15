<?php

declare(strict_types=1);

namespace App\Domain\Notifications\Enums;

use App\Domain\Accounts\Models\User;
use Illuminate\Support\Facades\URL;

/**
 * Вид письма-уведомления, который пользователь может выключить в «Кабинет → Профиль» (UC-A2, N1).
 * Служебные письма — код входа и подобные — сюда не входят: они уходят всегда.
 * Письма о сообщениях (4.4.1) и о снижении цены в избранном (4.3.1); остальные виды добавляют задачи G2.
 */
enum NotificationKind: string
{
    case NewMessage = 'new_message';
    case PriceDrop = 'price_drop';

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
