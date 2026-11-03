<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Jobs;

use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\InstrumentModel;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Приводит индекс подсказки в соответствие видимости: модели категории и её поддерева
 * добавляются в индекс, если они public, и убираются, если нет.
 */
final class SyncCategoryModelsIndex implements ShouldQueue
{
    use Dispatchable;
    use Queueable;

    public function __construct(public readonly int $categoryId) {}

    public function handle(): void
    {
        $models = InstrumentModel::query()
            ->whereIn('category_id', $this->subtreeIds())
            ->get();

        foreach ($models as $model) {
            $model->shouldBeSearchable() ? $model->searchable() : $model->unsearchable();
        }
    }

    /** @return list<int> сама категория и все её потомки */
    private function subtreeIds(): array
    {
        $ids = [$this->categoryId];
        $frontier = [$this->categoryId];

        while ($frontier !== []) {
            $frontier = Category::query()
                ->whereIn('parent_id', $frontier)
                ->pluck('id')
                ->map(fn ($id): int => (int) $id)
                ->all();
            $ids = [...$ids, ...$frontier];
        }

        return array_values(array_unique($ids));
    }
}
