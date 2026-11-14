<?php

declare(strict_types=1);

namespace App\Domain\Listings\Rules;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Exceptions\ListingLimitReached;
use App\Domain\Listings\Models\Listing;
use Illuminate\Support\Facades\Config;

/**
 * Лимит активных объявлений частного лица (BR-06). Активные — published, pending и needs_changes:
 * они занимают место; черновик, снятое, истёкшее и отклонённое — нет. Публикация вызывает assertAvailable()
 * под блокировкой строки пользователя, поэтому две параллельные публикации не обходят лимит.
 */
final class ActiveListingLimit
{
    /** @var list<ListingStatus> */
    public const ACTIVE = [ListingStatus::Published, ListingStatus::Pending, ListingStatus::NeedsChanges];

    public static function max(): int
    {
        return Config::integer('listings.active_limit');
    }

    public static function activeCount(User $user): int
    {
        return Listing::query()
            ->where('user_id', $user->id)
            ->whereIn('status', array_map(fn (ListingStatus $status): string => $status->value, self::ACTIVE))
            ->count();
    }

    /** @throws ListingLimitReached */
    public static function assertAvailable(User $user): void
    {
        $used = self::activeCount($user);
        if ($used >= self::max()) {
            throw new ListingLimitReached($used, self::max());
        }
    }
}
