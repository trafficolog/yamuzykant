<?php

declare(strict_types=1);

namespace App\Domain\Search;

/**
 * Сортировки выдачи Барахолки в адресе. «Рядом» в MVP нет (решение OWNER 07.11.2026):
 * выдача ограничена городом, собственных координат у объявления нет.
 */
enum FleaSort: string
{
    case Newest = 'new';
    case PriceAsc = 'cheap';
    case PriceDesc = 'expensive';

    public function listingSort(): ListingSort
    {
        return match ($this) {
            self::Newest => ListingSort::Newest,
            self::PriceAsc => ListingSort::PriceAsc,
            self::PriceDesc => ListingSort::PriceDesc,
        };
    }
}
