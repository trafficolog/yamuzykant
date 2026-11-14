<?php

declare(strict_types=1);

namespace App\Domain\Moderation\Listeners;

use App\Domain\Listings\Enums\ListingEvent;
use App\Domain\Listings\Events\ListingTransitioned;
use App\Domain\Moderation\Jobs\AssessListingRisk;

/**
 * Новое или существенно изменённое объявление (UC-O1) ставит автопроверки в очередь: первая публикация
 * или отправка на проверку, существенная правка, повторная отправка после доработки. Подписан на все события
 * `App\Domain\Listings\Events\*`; снятие, одобрение, истечение, цена и несущественные правки проверок не ставят.
 */
final class QueueListingRiskAssessment
{
    /** @var list<ListingEvent> */
    private const TRIGGERS = [ListingEvent::Publish, ListingEvent::SubstantialEdit, ListingEvent::Resubmit];

    /** @param  array<int, mixed>  $payload */
    public function handle(string $eventName, array $payload): void
    {
        $event = $payload[0] ?? null;
        if (! $event instanceof ListingTransitioned) {
            return;
        }

        if (in_array($event->event, self::TRIGGERS, true)) {
            // После фиксации: публикация идёт в транзакции под блокировкой лимита, очередь не должна опередить commit.
            AssessListingRisk::dispatch($event->listing->id)->afterCommit();
        }
    }
}
