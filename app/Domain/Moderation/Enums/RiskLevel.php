<?php

declare(strict_types=1);

namespace App\Domain\Moderation\Enums;

/** Риск объявления по автопроверкам (UC-O1): есть хотя бы один признак — high, иначе normal. */
enum RiskLevel: string
{
    case High = 'high';
    case Normal = 'normal';
}
