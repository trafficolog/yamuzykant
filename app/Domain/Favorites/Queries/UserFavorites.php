<?php

declare(strict_types=1);

namespace App\Domain\Favorites\Queries;

use App\Domain\Accounts\Models\User;
use App\Domain\Favorites\Models\Favorite;
use Illuminate\Pagination\LengthAwarePaginator;

/** Избранное пользователя для вкладки кабинета: свежее добавленное первым, снятые с публикации — тоже. */
final class UserFavorites
{
    public const PER_PAGE = 24;

    /** @return LengthAwarePaginator<int, Favorite> */
    public function page(User $user): LengthAwarePaginator
    {
        return Favorite::query()
            ->where('user_id', $user->id)
            ->with(['listing.city', 'listing.photos'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(self::PER_PAGE);
    }
}
