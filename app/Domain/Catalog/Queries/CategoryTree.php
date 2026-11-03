<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Queries;

use App\Domain\Catalog\Models\Category;
use Illuminate\Database\Eloquent\Collection;

/**
 * Дерево категорий из плоской таблицы: один запрос, сборка в памяти.
 * Публичное дерево не содержит скрытые категории и всё их поддерево.
 */
final class CategoryTree
{
    /**
     * Полное дерево (для консоли): корни с вложенным `children`, по `sort_order`.
     *
     * @return Collection<int, Category>
     */
    public function all(): Collection
    {
        return $this->build(false);
    }

    /**
     * Дерево для публичных props.
     *
     * @return Collection<int, Category>
     */
    public function public(): Collection
    {
        return $this->build(true);
    }

    /**
     * Идентификаторы всех публично видимых категорий (сама и все предки видимы).
     *
     * @return list<int>
     */
    public function visibleIds(): array
    {
        return $this->flatten($this->public());
    }

    /**
     * @param  Collection<int, Category>  $nodes
     * @return list<int>
     */
    private function flatten(Collection $nodes): array
    {
        $ids = [];
        foreach ($nodes as $node) {
            $ids[] = $node->id;
            array_push($ids, ...$this->flatten($node->children));
        }

        return $ids;
    }

    /** @return Collection<int, Category> */
    private function build(bool $onlyVisible): Collection
    {
        /** @var array<int, list<Category>> $byParent */
        $byParent = [];
        $rows = Category::query()
            ->when($onlyVisible, fn ($query) => $query->where('is_visible', true))
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        foreach ($rows as $category) {
            $byParent[$category->parent_id ?? 0][] = $category;
        }

        foreach ($rows as $category) {
            $category->setRelation('children', new Collection($byParent[$category->id] ?? []));
        }

        // Потомки скрытой категории не достижимы от корней, поэтому в публичное дерево не попадут.
        return new Collection($byParent[0] ?? []);
    }
}
