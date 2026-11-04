<?php

declare(strict_types=1);

namespace App\Domain\Moderation\Enums;

/**
 * Решение модератора по объявлению (SPEC UC-O1).
 */
enum ModerationVerdict: string
{
    case Approved = 'approved';
    case Returned = 'returned';
    case Rejected = 'rejected';
}
