<?php

declare(strict_types=1);

namespace App\Domain\Listings\Queries;

use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Search\ListingSearch;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * «Похожие лоты рядом» на странице объявления (UC-V1): опубликованные из того же города и той же категории,
 * свежие первыми, без самого объявления. Расстояний нет (решение OWNER: сортировки «рядом» нет).
 * Поиск недоступен — блок пуст, страница объявления от него не зависит.
 */
final class SimilarListings
{
    public const LIMIT = 5;

    /** @return Collection<int, Listing> в порядке выдачи */
    public function for(Listing $listing): Collection
    {
        if ($listing->city === null || $listing->category === null) {
            return new Collection;
        }

        try {
            // На одно больше: среди найденных может оказаться само объявление.
            $result = ListingSearch::inCity($listing->city)
                ->inCategory($listing->category)
                ->get(1, self::LIMIT + 1);
        } catch (Throwable $e) {
            Log::warning('Похожие объявления недоступны: поиск не ответил.', ['listing' => $listing->id, 'error' => $e->getMessage()]);

            return new Collection;
        }

        $ids = array_slice(array_values(array_filter($result->ids, fn (string $id): bool => $id !== $listing->id)), 0, self::LIMIT);
        if ($ids === []) {
            return new Collection;
        }

        // Индекс мог отстать от БД: берём только то, что сейчас опубликовано.
        $found = Listing::query()
            ->whereIn('id', $ids)
            ->where('status', ListingStatus::Published->value)
            ->with(['city', 'photos'])
            ->get()
            ->keyBy('id');

        return (new Collection($ids))
            ->map(fn (string $id): ?Listing => $found->get($id))
            ->filter()
            ->values();
    }
}
