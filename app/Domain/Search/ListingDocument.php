<?php

declare(strict_types=1);

namespace App\Domain\Search;

use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Search\ModelAliases;
use App\Domain\Listings\Models\Listing;

/**
 * Документ объявления в поисковом индексе (ARCHITECTURE §5). Координат нет: «рядом» в MVP не бывает (решение OWNER 07.11.2026). Поля перечислены явно:
 * серийного номера, e-mail, user_id, итоговой цены и прочего, чего нет в списке, в индексе не бывает.
 */
final class ListingDocument
{
    /** Связи, которые нужны документу: подгружаются пачкой, а не по запросу на объявление. */
    public const RELATIONS = ['model', 'category.parent.parent'];

    /** @return array<string, mixed> */
    public static function for(Listing $listing): array
    {
        $model = $listing->model;

        return [
            'id' => $listing->id,
            'title' => $listing->title,
            'model' => $model?->name,
            'brand' => $model?->brand,
            // Русские написания модели («стратокастер»): настройки synonyms на Meilisearch 1.10 не работали (сессия 1.2.2).
            'aliases' => ModelAliases::for((string) $model?->brand, trim((string) $model?->name.' '.$listing->title)),
            'description' => $listing->description,
            'category_path' => self::categoryPath($listing->category),
            'condition' => $listing->condition?->value,
            'price' => $listing->price,
            'city_id' => $listing->city_id,
            'ship' => $listing->ship,
            'negotiable' => $listing->negotiable,
            'published_at' => $listing->published_at?->getTimestamp(),
        ];
    }

    /**
     * Путь от корня дерева категорий нарастающим итогом: ['gitary', 'gitary/elektrogitary'].
     * Фильтр по любому элементу пути выбирает всё поддерево.
     *
     * @return list<string>
     */
    public static function categoryPath(?Category $category): array
    {
        $slugs = [];
        for ($node = $category; $node !== null; $node = $node->parent) {
            array_unshift($slugs, $node->slug);
        }

        $paths = [];
        foreach ($slugs as $index => $slug) {
            $paths[] = $index === 0 ? $slug : $paths[$index - 1].'/'.$slug;
        }

        return $paths;
    }
}
