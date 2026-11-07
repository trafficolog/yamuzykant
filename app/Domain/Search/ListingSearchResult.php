<?php

declare(strict_types=1);

namespace App\Domain\Search;

/** Страница выдачи: id в порядке выдачи, документы индекса, точное общее число и фасеты. */
final readonly class ListingSearchResult
{
    /**
     * @param  list<string>  $ids
     * @param  list<array<string, mixed>>  $hits
     * @param  array{condition: array<string, int>, category_path: array<string, int>}  $facets
     */
    public function __construct(
        public array $ids,
        public array $hits,
        public int $total,
        public int $page,
        public int $perPage,
        public array $facets,
        public int $processingTimeMs,
    ) {}
}
