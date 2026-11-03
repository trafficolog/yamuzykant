<?php

declare(strict_types=1);

namespace App\Domain\Listings\Enums;

/**
 * Событие жизненного цикла объявления — стрелка диаграммы SPEC §6.1.
 */
enum ListingEvent: string
{
    case Publish = 'publish';
    case Approve = 'approve';
    case Return = 'return';
    case Reject = 'reject';
    case Resubmit = 'resubmit';
    case SubstantialEdit = 'substantial_edit';
    case MinorEdit = 'minor_edit';
    case PriceDrop = 'price_drop';
    case Withdraw = 'withdraw';
    case Expire = 'expire';
    case Renew = 'renew';
    case Relist = 'relist';
}
