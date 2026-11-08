<?php

declare(strict_types=1);

namespace App\Domain\Search;

use App\Domain\Catalog\Models\City;
use Illuminate\Support\Facades\Cache;

/**
 * Рельсы главной (UC-S2, BR-01): «Новые в городе» и «Готовы к торгу». Каждый — один запрос к индексу
 * с лимитом, без обращений к БД за карточками. Результат кэшируется на 60 с на город: главная — самая
 * посещаемая страница, а свежесть в минуту ей достаточна.
 */
final class HomeRails
{
    /** Карточек в рельсе. */
    public const LIMIT = 10;

    /** Время жизни кэша блоков, секунды. */
    public const TTL = 60;

    /**
     * Документы индекса для рельсов города. Без города (справочник пуст) рельсы пусты.
     *
     * @return array{fresh: list<array<string, mixed>>, negotiable: list<array<string, mixed>>}
     */
    public function for(?City $city): array
    {
        if ($city === null) {
            return ['fresh' => [], 'negotiable' => []];
        }

        /** @var array{fresh: list<array<string, mixed>>, negotiable: list<array<string, mixed>>} */
        return Cache::remember(self::key($city), self::TTL, fn (): array => [
            'fresh' => ListingSearch::inCity($city)->get(1, self::LIMIT)->hits,
            'negotiable' => ListingSearch::inCity($city)->negotiable()->get(1, self::LIMIT)->hits,
        ]);
    }

    public static function key(City $city): string
    {
        return 'home:rails:'.$city->id;
    }
}
