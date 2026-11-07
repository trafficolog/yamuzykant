<?php

declare(strict_types=1);

namespace App\Domain\Search;

use App\Domain\Listings\Enums\Condition;

/**
 * Фильтры выдачи Барахолки из адреса (UC-S2, UC-S3). Разбор терпим к мусору: лишнее отбрасывается,
 * исключений нет. Город сюда не входит: он берётся из шапки (BR-01).
 */
final readonly class FleaFilters
{
    public const PER_PAGE = 24;

    private const MAX_QUERY = 100;

    /** Предел цены: больше любого разумного инструмента, меньше переполнения int. */
    private const MAX_PRICE = 1_000_000_000;

    /** @param  list<Condition>  $conditions */
    public function __construct(
        public string $query = '',
        public array $conditions = [],
        public ?int $priceFrom = null,
        public ?int $priceTo = null,
        public bool $negotiable = false,
        public bool $ship = false,
        public ?FleaSort $sort = null,
        public int $page = 1,
    ) {}

    /** @param  array<array-key, mixed>  $query */
    public static function fromQuery(array $query): self
    {
        $q = $query['q'] ?? '';

        return new self(
            query: is_string($q) ? mb_substr(trim($q), 0, self::MAX_QUERY) : '',
            conditions: self::conditions($query['condition'] ?? null),
            priceFrom: self::price($query['price_from'] ?? null),
            priceTo: self::price($query['price_to'] ?? null),
            negotiable: ($query['negotiable'] ?? null) === '1',
            ship: ($query['ship'] ?? null) === '1',
            sort: is_string($query['sort'] ?? null) ? FleaSort::tryFrom($query['sort']) : null,
            page: self::page($query['page'] ?? null),
        );
    }

    /**
     * Параметры адреса: только заданное, порядок стабилен (совпадает с фронтом, Pages/Flea/query.ts).
     *
     * @return array<string, mixed>
     */
    public function toQuery(): array
    {
        $query = [];
        if ($this->query !== '') {
            $query['q'] = $this->query;
        }
        if ($this->conditions !== []) {
            $query['condition'] = array_map(fn (Condition $condition): string => $condition->value, $this->conditions);
        }
        if ($this->priceFrom !== null) {
            $query['price_from'] = $this->priceFrom;
        }
        if ($this->priceTo !== null) {
            $query['price_to'] = $this->priceTo;
        }
        if ($this->negotiable) {
            $query['negotiable'] = 1;
        }
        if ($this->ship) {
            $query['ship'] = 1;
        }
        if ($this->sort !== null) {
            $query['sort'] = $this->sort->value;
        }
        if ($this->page > 1) {
            $query['page'] = $this->page;
        }

        return $query;
    }

    public function apply(ListingSearch $search): ListingSearch
    {
        if ($this->query !== '') {
            $search = $search->matching($this->query);
        }
        if ($this->conditions !== []) {
            $search = $search->conditions($this->conditions);
        }
        if ($this->priceFrom !== null || $this->priceTo !== null) {
            $search = $search->priceBetween($this->priceFrom, $this->priceTo);
        }
        if ($this->ship) {
            $search = $search->withShipping();
        }
        if ($this->negotiable) {
            $search = $search->negotiable();
        }
        if ($this->sort !== null) {
            $search = $search->sortBy($this->sort->listingSort());
        }

        return $search;
    }

    public function withPage(int $page): self
    {
        return new self(
            $this->query, $this->conditions, $this->priceFrom, $this->priceTo, $this->negotiable, $this->ship, $this->sort, max(1, $page),
        );
    }

    public function withoutConditions(): self
    {
        return new self(
            $this->query, [], $this->priceFrom, $this->priceTo, $this->negotiable, $this->ship, $this->sort, $this->page,
        );
    }

    /** @return list<Condition> */
    private static function conditions(mixed $raw): array
    {
        $values = match (true) {
            is_array($raw) => $raw,
            is_string($raw) => explode(',', $raw),
            default => [],
        };

        $found = [];
        foreach ($values as $value) {
            $condition = is_string($value) ? Condition::tryFrom(trim($value)) : null;
            if ($condition !== null) {
                $found[$condition->value] = $condition;
            }
        }

        // Порядок BR-02 (от лучшего к худшему), а не порядок в адресе: адрес одного набора всегда один.
        return array_values(array_filter(
            Condition::cases(),
            fn (Condition $condition): bool => isset($found[$condition->value]),
        ));
    }

    private static function price(mixed $raw): ?int
    {
        if (! is_string($raw) || ! ctype_digit($raw) || strlen($raw) > 10) {
            return null;
        }
        $price = (int) $raw;

        return $price <= self::MAX_PRICE ? $price : null;
    }

    private static function page(mixed $raw): int
    {
        if (! is_string($raw) || ! ctype_digit($raw) || strlen($raw) > 6) {
            return 1;
        }

        return max(1, (int) $raw);
    }
}
