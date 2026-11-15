<?php

declare(strict_types=1);

namespace App\Domain\Favorites\Queries;

use App\Domain\Accounts\Models\User;
use App\Domain\Favorites\Models\Favorite;

/** Какие из объявлений страницы у зрителя в избранном: один запрос на страницу, а не на карточку. Гость — ни одного. */
final class FavoriteListingIds
{
    /**
     * @param  array<int, string>  $listingIds
     * @return array<string, true> id объявления → в избранном
     */
    public static function among(?User $viewer, array $listingIds): array
    {
        if ($viewer === null || $listingIds === []) {
            return [];
        }

        $found = [];
        foreach (Favorite::query()->where('user_id', $viewer->id)->whereIn('listing_id', $listingIds)->pluck('listing_id') as $id) {
            $found[(string) $id] = true;
        }

        return $found;
    }
}
