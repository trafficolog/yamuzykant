<?php

declare(strict_types=1);

namespace App\Domain\Listings\Rules;

use App\Domain\Listings\Exceptions\PhotoRequirementsNotMet;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use Illuminate\Support\Facades\Config;

/**
 * Лимиты фото для публикации (BR-03, UC-L1 п. 4): от 3 до 12 фото, одно — серийный номер.
 * Фото с ошибкой обработки не считаются. Публикация (2.1.4) вызывает assertSatisfied() до перехода.
 */
final class PhotoRequirements
{
    public static function check(Listing $listing): PhotoShortfall
    {
        $counted = ListingPhoto::query()->where('listing_id', $listing->id)->counted();
        $count = (clone $counted)->count();
        $hasSerial = (clone $counted)->where('is_serial', true)->exists();

        return new PhotoShortfall(
            missingPhotos: max(0, Config::integer('photos.min') - $count),
            missingSerial: ! $hasSerial,
            extraPhotos: max(0, $count - Config::integer('photos.max')),
        );
    }

    /** @throws PhotoRequirementsNotMet */
    public static function assertSatisfied(Listing $listing): void
    {
        $shortfall = self::check($listing);
        if (! $shortfall->satisfied()) {
            throw new PhotoRequirementsNotMet($shortfall);
        }
    }
}
