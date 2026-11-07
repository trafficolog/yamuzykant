<?php

declare(strict_types=1);

namespace App\Domain\Search\Listeners;

use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Events\ListingTransitioned;
use App\Domain\Search\Jobs\SyncListingToIndex;

/**
 * Любой переход машины статусов, в котором объявление было опубликовано или стало опубликованным,
 * ставит в очередь синхронизацию индекса. Подписан на все события `App\Domain\Listings\Events\*`,
 * поэтому новое событие машины подхватывается без правок.
 */
final class QueueListingIndexSync
{
    /** @param  array<int, mixed>  $payload */
    public function handle(string $eventName, array $payload): void
    {
        $event = $payload[0] ?? null;
        if (! $event instanceof ListingTransitioned) {
            return;
        }

        if ($event->from === ListingStatus::Published || $event->to === ListingStatus::Published) {
            SyncListingToIndex::dispatch($event->listing->id);
        }
    }
}
