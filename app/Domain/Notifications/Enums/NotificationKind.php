<?php

declare(strict_types=1);

namespace App\Domain\Notifications\Enums;

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
}
