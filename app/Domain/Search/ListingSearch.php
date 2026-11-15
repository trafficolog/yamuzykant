<?php

declare(strict_types=1);

namespace App\Domain\Search;

use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\City;
use App\Domain\Listings\Enums\Condition;
use Illuminate\Support\Arr;

/**
 * Запрос к индексу объявлений (UC-S2, UC-S3). Город обязателен (BR-01): поиска без города не бывает,
 * `inCity()` — единственный способ его создать. Остальное — необязательные уточнения.
 * Объект неизменяемый: каждый вызов возвращает копию.
 */
final class ListingSearch
{
    private string $query = '';

    private ?string $categoryPath = null;

    /** @var list<Condition> */
    private array $conditions = [];

    private ?int $priceFrom = null;

    private ?int $priceTo = null;

    private bool $shipping = false;

    private bool $negotiable = false;

    private ?ListingSort $sort = null;

    private function __construct(
        private readonly City $city,
        private readonly ListingIndex $index,
    ) {}

    public static function inCity(City $city, ?ListingIndex $index = null): self
    {
        return new self($city, $index ?? ListingIndex::default());
    }

    public function matching(string $query): self
    {
        $clone = clone $this;
        $clone->query = trim($query);

        return $clone;
    }

    /** Категория или её путь (`gitary/elektrogitary`): вся ветка. */
    public function inCategory(Category|string $category): self
    {
        $clone = clone $this;
        $clone->categoryPath = $category instanceof Category
            ? Arr::last(ListingDocument::categoryPath($category))
            : $category;

        return $clone;
    }

    /** @param  list<Condition>  $conditions */
    public function conditions(array $conditions): self
    {
        $clone = clone $this;
        $clone->conditions = $conditions;

        return $clone;
    }

    /** Цена в рублях, границы включительно; null — граница не задана. */
    public function priceBetween(?int $from, ?int $to): self
    {
        $clone = clone $this;
        $clone->priceFrom = $from;
        $clone->priceTo = $to;

        return $clone;
    }

    public function withShipping(): self
    {
        $clone = clone $this;
        $clone->shipping = true;

        return $clone;
    }

    public function negotiable(): self
    {
        $clone = clone $this;
        $clone->negotiable = true;

        return $clone;
    }

    public function sortBy(ListingSort $sort): self
    {
        $clone = clone $this;
        $clone->sort = $sort;

        return $clone;
    }

    public function get(int $page = 1, int $perPage = 24): ListingSearchResult
    {
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));

        $options = [
            'filter' => $this->filters(),
            'facets' => ['condition', 'category_path'],
            'page' => $page,
            'hitsPerPage' => $perPage,
        ];
        $sort = $this->sortExpression();
        if ($sort !== null) {
            // Второй ключ — id (UUIDv7, растёт со временем): у равных дат (секунды) и цен порядок постоянный (3.1.12).
            $options['sort'] = [$sort, 'id:desc'];
        }

        $result = $this->index->index()->search($this->query, $options);

        /** @var list<array<string, mixed>> $hits */
        $hits = array_values($result->getHits());
        $facets = $result->getFacetDistribution();

        return new ListingSearchResult(
            ids: array_map(fn (array $hit): string => (string) $hit['id'], $hits),
            hits: $hits,
            total: (int) $result->getTotalHits(),
            page: $page,
            perPage: $perPage,
            facets: [
                'condition' => $this->counts($facets['condition'] ?? []),
                'category_path' => $this->counts($facets['category_path'] ?? []),
            ],
            processingTimeMs: $result->getProcessingTimeMs(),
        );
    }

    /** @return list<string> */
    private function filters(): array
    {
        $filters = ['city_id = '.$this->city->id];

        if ($this->categoryPath !== null) {
            $filters[] = 'category_path = '.$this->quote($this->categoryPath);
        }
        if ($this->conditions !== []) {
            $filters[] = 'condition IN ['.implode(', ', array_map(
                fn (Condition $condition): string => $this->quote($condition->value),
                $this->conditions,
            )).']';
        }
        if ($this->priceFrom !== null) {
            $filters[] = 'price >= '.$this->priceFrom;
        }
        if ($this->priceTo !== null) {
            $filters[] = 'price <= '.$this->priceTo;
        }
        if ($this->shipping) {
            $filters[] = 'ship = true';
        }
        if ($this->negotiable) {
            $filters[] = 'negotiable = true';
        }

        return $filters;
    }

    private function sortExpression(): ?string
    {
        $sort = $this->sort ?? ($this->query === '' ? ListingSort::Newest : ListingSort::Relevance);

        return match ($sort) {
            ListingSort::Relevance => null,
            default => $sort->value,
        };
    }

    private function quote(string $value): string
    {
        return '"'.str_replace(['\\', '"'], ['\\\\', '\\"'], $value).'"';
    }

    /**
     * @param  array<array-key, mixed>  $distribution
     * @return array<string, int>
     */
    private function counts(array $distribution): array
    {
        $counts = [];
        foreach ($distribution as $value => $count) {
            $counts[(string) $value] = (int) $count;
        }

        return $counts;
    }
}
