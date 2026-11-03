<?php

declare(strict_types=1);

namespace App\Domain\Listings\Actions;

use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Exceptions\IllegalTransition;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\StateMachines\ListingStateMachine;

/**
 * Снимает с показа объявления, опубликованные дольше config listings.expire_after_days (SPEC §6.1).
 * Запускается по расписанию (routes/console.php).
 */
final class ExpireListings
{
    public function __construct(private readonly ListingStateMachine $machine) {}

    /** @return int сколько объявлений ушло в expired */
    public function __invoke(): int
    {
        $border = now()->subDays((int) config('listings.expire_after_days'));
        $expired = 0;

        Listing::query()
            ->where('status', ListingStatus::Published)
            ->where('published_at', '<=', $border)
            ->eachById(function (Listing $listing) use (&$expired): void {
                try {
                    $this->machine->expire($listing);
                    $expired++;
                } catch (IllegalTransition) {
                    // Статус успел смениться между выборкой и блокировкой — пропускаем.
                }
            });

        return $expired;
    }
}
