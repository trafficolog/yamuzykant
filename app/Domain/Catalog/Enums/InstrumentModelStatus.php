<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Enums;

/**
 * Статус модели в справочнике.
 * active — показывается в подсказках и фильтрах; suggested — предложена продавцом, ждёт решения;
 * hidden — скрыта сотрудником.
 */
enum InstrumentModelStatus: string
{
    case Active = 'active';
    case Suggested = 'suggested';
    case Hidden = 'hidden';
}
