<?php

declare(strict_types=1);

namespace App\Domain\Search\Actions;

use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Search\ListingDocument;
use App\Domain\Search\ListingIndex;
use Illuminate\Database\Eloquent\Collection;

/**
 * Сверка БД и индекса (ARCHITECTURE §5): догоняет потерянные события. Опубликованное, которого нет в индексе,
 * добавляется; документ, которому в БД не соответствует опубликованное объявление, убирается.
 * Содержимое уже лежащих документов не сравнивается — его чинит job при следующем событии.
 */
final class ReconcileListingIndex
{
    private const CHUNK = 500;

    /** @return array{added: int, removed: int} */
    public function __invoke(): array
    {
        /** @var array<string, int> $published */
        $published = Listing::query()
            ->where('status', ListingStatus::Published->value)
            ->pluck('id')
            ->flip()
            ->all();
        $indexed = array_flip(iterator_to_array(ListingIndex::default()->ids(), false));

        $missing = array_keys(array_diff_key($published, $indexed));
        $extra = array_keys(array_diff_key($indexed, $published));

        $engine = (new Listing)->searchableUsing();

        foreach (array_chunk($missing, self::CHUNK) as $ids) {
            $engine->update(Listing::query()->with(ListingDocument::RELATIONS)->whereKey($ids)->get());
        }

        foreach (array_chunk($extra, self::CHUNK) as $ids) {
            $engine->delete(new Collection(array_map(
                fn (int|string $id): Listing => (new Listing)->forceFill(['id' => (string) $id]),
                $ids,
            )));
        }

        return ['added' => count($missing), 'removed' => count($extra)];
    }
}
