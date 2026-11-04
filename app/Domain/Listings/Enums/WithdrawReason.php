<?php

declare(strict_types=1);

namespace App\Domain\Listings\Enums;

/**
 * Причина снятия с продажи (SPEC UC-L4; `moderation` — SPEC §6.4, блокировка пользователя).
 */
enum WithdrawReason: string
{
    case SoldHere = 'sold_here';
    case SoldElsewhere = 'sold_elsewhere';
    case ChangedMind = 'changed_mind';
    case Moderation = 'moderation';

    /** Продажа: можно указать итоговую цену, запись идёт в «Цены продаж». */
    public function isSale(): bool
    {
        return $this === self::SoldHere || $this === self::SoldElsewhere;
    }
}
