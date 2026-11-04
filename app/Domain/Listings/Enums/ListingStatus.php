<?php

declare(strict_types=1);

namespace App\Domain\Listings\Enums;

/**
 * Статус объявления (SPEC §6.1). Меняется только через ListingStateMachine.
 */
enum ListingStatus: string
{
    case Draft = 'draft';
    case Pending = 'pending';
    case Published = 'published';
    case NeedsChanges = 'needs_changes';
    case Rejected = 'rejected';
    case Withdrawn = 'withdrawn';
    case Expired = 'expired';
}
