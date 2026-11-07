<?php

declare(strict_types=1);

namespace App\Domain\Listings\Actions;

use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Exceptions\PhotoRejected;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use Illuminate\Support\Facades\DB;

/**
 * Новый порядок фото — перестановка всех фото объявления. Набор фото не меняется, поэтому у опубликованного
 * это несущественная правка (minor_edit через ListingStateMachine): обложка меняется без повторной проверки.
 */
final class ReorderListingPhotos
{
    /** Сдвиг позиций на время перестановки: уникальный индекс (listing_id, position) не мешает обмену. */
    private const SHIFT = 100;

    public function __construct(private readonly ListingStateMachine $machine) {}

    /**
     * @param  list<int>  $ids
     *
     * @throws PhotoRejected набор не совпадает с фото объявления
     */
    public function handle(Listing $listing, array $ids): void
    {
        DB::transaction(function () use ($listing, $ids): void {
            Listing::query()->whereKey($listing->id)->lockForUpdate()->firstOrFail();

            /** @var list<int> $current */
            $current = ListingPhoto::query()->where('listing_id', $listing->id)->pluck('id')->all();
            $sorted = $ids;
            sort($sorted);
            sort($current);
            if ($sorted !== $current) {
                throw PhotoRejected::staleOrder();
            }

            self::renumber($listing, $ids);
        });

        if ($listing->status === ListingStatus::Published) {
            $this->machine->edit($listing, []);
        }
    }

    /**
     * Позиции 0…n-1 в заданном порядке. Вызывать внутри транзакции.
     *
     * @param  array<int, int>  $ids
     */
    public static function renumber(Listing $listing, array $ids): void
    {
        $photos = ListingPhoto::query()->where('listing_id', $listing->id);
        (clone $photos)->increment('position', self::SHIFT);
        foreach (array_values($ids) as $position => $id) {
            (clone $photos)->whereKey($id)->update(['position' => $position]);
        }
    }
}
