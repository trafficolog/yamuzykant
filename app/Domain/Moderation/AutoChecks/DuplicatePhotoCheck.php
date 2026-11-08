<?php

declare(strict_types=1);

namespace App\Domain\Moderation\AutoChecks;

use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;

/**
 * Дубль фото: pHash фото объявления отличается от pHash фото другого продавца не больше чем на
 * `moderation.duplicate_photo_max_distance` бит (по карточке 5.1.1 — 6). Свои объявления не считаются:
 * повторная публикация того же инструмента — обычное дело. Черновики других продавцов не участвуют.
 * Только сигнал риска. Сравнение идёт в PHP: pHash — 16 hex-символов, а набор фото берётся без черновиков.
 */
final class DuplicatePhotoCheck implements AutoCheck
{
    public function code(): string
    {
        return 'duplicate_photo';
    }

    public function blocking(): bool
    {
        return false;
    }

    public function inspect(Listing $listing): array
    {
        if (! $listing->exists) {
            return [];
        }

        $own = ListingPhoto::query()
            ->where('listing_id', $listing->id)
            ->whereNull('failed_reason')
            ->whereNotNull('phash')
            ->pluck('phash')
            ->map(fn (mixed $hash): string => (string) $hash)
            ->unique()
            ->values();
        if ($own->isEmpty()) {
            return [];
        }

        $max = (int) config('moderation.duplicate_photo_max_distance');
        $best = null;

        $others = ListingPhoto::query()
            ->join('listings', 'listings.id', '=', 'listing_photos.listing_id')
            ->where('listings.user_id', '!=', $listing->user_id)
            ->where('listings.status', '!=', ListingStatus::Draft->value)
            ->whereNull('listing_photos.failed_reason')
            ->whereNotNull('listing_photos.phash')
            ->select('listing_photos.listing_id', 'listing_photos.phash')
            ->cursor();

        foreach ($others as $other) {
            foreach ($own as $hash) {
                $distance = PerceptualHash::distance($hash, (string) $other->phash);
                if ($distance <= $max && ($best === null || $distance < $best['distance'])) {
                    $best = ['listing_id' => (string) $other->listing_id, 'distance' => $distance];
                }
            }
            if ($best !== null && $best['distance'] === 0) {
                break;
            }
        }

        if ($best === null) {
            return [];
        }

        return [new Finding(
            code: $this->code(),
            field: 'photos',
            message: (string) __('moderation.signals.duplicate_photo', [
                'listing' => $best['listing_id'],
                'distance' => $best['distance'],
                'max' => PerceptualHash::BITS,
            ]),
            details: $best,
        )];
    }
}
