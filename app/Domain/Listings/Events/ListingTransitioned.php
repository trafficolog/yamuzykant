<?php

declare(strict_types=1);

namespace App\Domain\Listings\Events;

use App\Domain\Listings\Enums\ListingEvent;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Переход объявления по SPEC §6.1. У каждого события машины — свой подкласс,
 * слушатели (автопроверки, индекс, уведомления) подписываются на нужный.
 * Отправляется после фиксации транзакции перехода.
 */
abstract class ListingTransitioned implements ShouldDispatchAfterCommit
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public Listing $listing,
        public ListingStatus $from,
        public ListingStatus $to,
        public ListingEvent $event,
    ) {}
}
