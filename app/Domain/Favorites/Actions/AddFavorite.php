<?php

declare(strict_types=1);

namespace App\Domain\Favorites\Actions;

use App\Domain\Accounts\Models\User;
use App\Domain\Favorites\Models\Favorite;
use App\Domain\Listings\Models\Listing;

/**
 * Добавляет объявление в избранное. Идемпотентно: повтор (двойной клик, повтор после входа гостя) ничего
 * не меняет, цена на момент первого добавления остаётся. Что объявление опубликовано, проверяет вызывающий
 * (ListingPolicy::favorite).
 */
final class AddFavorite
{
    public function handle(User $user, Listing $listing): Favorite
    {
        // createOrFirst: параллельные запросы не падают на уникальном индексе.
        return Favorite::query()->createOrFirst(
            ['user_id' => $user->id, 'listing_id' => $listing->id],
            ['price_at_save' => $listing->price],
        );
    }
}
