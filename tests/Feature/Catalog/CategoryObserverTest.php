<?php

declare(strict_types=1);

use App\Domain\Catalog\Jobs\SyncCategoryModelsIndex;
use App\Domain\Catalog\Models\Category;
use Illuminate\Support\Facades\Bus;

// Ревью 1.2.2 (подсказка модели): наблюдатель реагирует на смену видимости, смену родителя и удаление.

it('смена parent_id пересинхронизирует индекс поддерева категории', function () {
    $oldParent = Category::factory()->create(['name' => 'Гитары', 'slug' => 'obs-old']);
    $newParent = Category::factory()->create(['name' => 'Педали', 'slug' => 'obs-new']);
    $child = Category::factory()->for($oldParent, 'parent')->create(['name' => 'Бас', 'slug' => 'obs-child']);

    Bus::fake([SyncCategoryModelsIndex::class]);

    $child->update(['parent_id' => $newParent->id]);

    Bus::assertDispatched(SyncCategoryModelsIndex::class, fn (SyncCategoryModelsIndex $job): bool => $job->categoryId === $child->id);
});

it('удаление категории пересинхронизирует индекс', function () {
    $category = Category::factory()->create(['name' => 'Архив', 'slug' => 'obs-delete']);

    Bus::fake([SyncCategoryModelsIndex::class]);

    $category->delete();

    Bus::assertDispatched(SyncCategoryModelsIndex::class, fn (SyncCategoryModelsIndex $job): bool => $job->categoryId === $category->id);
});

it('смена только названия не ставит пересинхронизацию индекса', function () {
    $category = Category::factory()->create(['name' => 'Гитары', 'slug' => 'obs-name']);

    Bus::fake([SyncCategoryModelsIndex::class]);

    $category->update(['name' => 'Гитары и бас']);

    Bus::assertNotDispatched(SyncCategoryModelsIndex::class);
});
