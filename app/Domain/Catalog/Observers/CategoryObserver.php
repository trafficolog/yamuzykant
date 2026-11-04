<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Observers;

use App\Domain\Catalog\Jobs\SyncCategoryModelsIndex;
use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Queries\PublicCategoriesCache;

/**
 * Любое сохранение и удаление сбрасывает кэш публичного дерева. Смена видимости или родителя, а также удаление
 * пересинхронизируют индекс подсказки её моделей (через очередь): видимость поддерева зависит от предков.
 */
final class CategoryObserver
{
    public function saved(Category $category): void
    {
        PublicCategoriesCache::forget();

        if ($category->wasChanged(['is_visible', 'parent_id'])) {
            SyncCategoryModelsIndex::dispatch($category->id);
        }
    }

    public function deleted(Category $category): void
    {
        PublicCategoriesCache::forget();

        SyncCategoryModelsIndex::dispatch($category->id);
    }
}
