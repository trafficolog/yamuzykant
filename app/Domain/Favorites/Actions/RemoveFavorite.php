<?php

declare(strict_types=1);

namespace App\Domain\Favorites\Actions;

use App\Domain\Accounts\Models\User;
use App\Domain\Favorites\Models\Favorite;

/** Убирает объявление из избранного пользователя; идемпотентно, в том числе для снятого с публикации. */
final class RemoveFavorite
{
    public function handle(User $user, string $listingId): void
    {
        Favorite::query()->where('user_id', $user->id)->where('listing_id', $listingId)->delete();
    }
}
