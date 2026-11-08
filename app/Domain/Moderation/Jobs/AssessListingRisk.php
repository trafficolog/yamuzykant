<?php

declare(strict_types=1);

namespace App\Domain\Moderation\Jobs;

use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Moderation\AutoChecks\Finding;
use App\Domain\Moderation\AutoChecks\ListingAutoChecks;
use App\Domain\Moderation\Models\ModerationFlag;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Автопроверки после публикации и существенной правки (UC-O1): дубль фото, цена ниже рынка, стоп-слова,
 * контакты → moderation_flags с риском и пояснениями. Решает по состоянию на момент выполнения, поэтому повтор
 * безвреден: флаг объявления перезаписывается. Объявление не в published и не в pending (снято, черновик,
 * удалено) пропускается.
 *
 * Флаг `premoderation` здесь не нужен: с ним объявление уже в статусе pending, и очередь консоли (5.1.2) берёт
 * его вместе с этим флагом; без флага объявление опубликовано сразу, флаги копятся для будущей очереди.
 */
final class AssessListingRisk implements ShouldQueue
{
    use Dispatchable;
    use Queueable;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [5, 30];

    public function __construct(public readonly string $listingId) {}

    public function handle(ListingAutoChecks $checks): void
    {
        $listing = Listing::query()->find($this->listingId);
        if ($listing === null || ! in_array($listing->status, [ListingStatus::Published, ListingStatus::Pending], true)) {
            return;
        }

        $report = $checks->assess($listing);

        ModerationFlag::query()->updateOrCreate(
            ['listing_id' => $listing->id],
            [
                'risk' => $report->risk(),
                'signals' => array_map(static fn (Finding $finding): array => $finding->toArray(), $report->signals()),
            ],
        );
    }
}
