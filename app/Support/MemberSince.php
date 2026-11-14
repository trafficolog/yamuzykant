<?php

declare(strict_types=1);

namespace App\Support;

use Carbon\CarbonInterface;

/**
 * Месяц регистрации для подписи «на ЯМузыканте с марта 2026» (профиль, карточка продавца). Наружу — `ГГГГ-ММ`;
 * слово «марта» собирает фронт (lib/account.ts). Отображение — Europe/Moscow.
 */
final class MemberSince
{
    public static function month(?CarbonInterface $createdAt): ?string
    {
        return $createdAt?->copy()->setTimezone('Europe/Moscow')->format('Y-m');
    }
}
