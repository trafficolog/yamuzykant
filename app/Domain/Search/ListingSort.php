<?php

declare(strict_types=1);

namespace App\Domain\Search;

/** Сортировки выдачи (ARCHITECTURE §5). Без явного выбора: запрос — по релевантности, без запроса — новые. */
enum ListingSort: string
{
    case Relevance = 'relevance';
    case Newest = 'published_at:desc';
    case PriceAsc = 'price:asc';
    case PriceDesc = 'price:desc';
    case Nearest = '_geoPoint';
}
