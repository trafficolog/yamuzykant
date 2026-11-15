<?php

declare(strict_types=1);

namespace App\Domain\Listings\Queries;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use Illuminate\Database\Eloquent\Collection;

/**
 * Объявления продавца для вкладки «Объявления» кабинета (2.1.5): свои, кроме черновиков (черновик — форма продажи),
 * с фильтром по группам статусов.
 */
final class MyListings
{
    public const ALL = 'all';

    /** @var array<string, list<ListingStatus>> группа фильтра → статусы */
    private const GROUPS = [
        'published' => [ListingStatus::Published],
        'review' => [ListingStatus::Pending, ListingStatus::NeedsChanges],
        'closed' => [ListingStatus::Withdrawn, ListingStatus::Expired, ListingStatus::Rejected],
    ];

    /** Фильтр из запроса: неизвестное значение — «все». */
    public static function filter(?string $value): string
    {
        return $value !== null && isset(self::GROUPS[$value]) ? $value : self::ALL;
    }

    /** @return Collection<int, Listing> */
    public function for(User $user, string $filter): Collection
    {
        return Listing::query()
            ->where('user_id', $user->id)
            ->whereIn('status', $this->statuses($filter))
            ->with(['photos', 'moderationDecisions' => fn ($query) => $query->latest('id')])
            ->withCount('conversations')
            ->latest('created_at')
            ->get();
    }

    /** @return array<string, int> число объявлений по каждой группе фильтра */
    public function counts(User $user): array
    {
        $byStatus = Listing::query()
            ->where('user_id', $user->id)
            ->whereIn('status', $this->statuses(self::ALL))
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $counts = [self::ALL => (int) $byStatus->sum()];
        foreach (self::GROUPS as $group => $statuses) {
            $counts[$group] = (int) array_sum(array_map(fn (ListingStatus $status): int => (int) ($byStatus[$status->value] ?? 0), $statuses));
        }

        return $counts;
    }

    /** @return list<string> */
    private function statuses(string $filter): array
    {
        $statuses = $filter === self::ALL ? array_merge(...array_values(self::GROUPS)) : self::GROUPS[$filter];

        return array_map(fn (ListingStatus $status): string => $status->value, $statuses);
    }
}
