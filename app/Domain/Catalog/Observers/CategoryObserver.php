<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Observers;

use App\Domain\Catalog\Jobs\SyncCategoryModelsIndex;
use App\Domain\Catalog\Models\Category;

/** Смена видимости категории пересинхронизирует индекс подсказки её моделей (через очередь). */
final class CategoryObserver
{
    public function saved(Category $category): void
    {
        if ($category->wasChanged('is_visible')) {
            SyncCategoryModelsIndex::dispatch($category->id);
        }
    }
}
