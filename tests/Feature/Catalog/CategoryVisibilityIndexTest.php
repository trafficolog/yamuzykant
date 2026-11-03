<?php

declare(strict_types=1);

use App\Domain\Catalog\Enums\InstrumentModelStatus;
use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\InstrumentModel;
use Tests\Support\MeilisearchIndex;

// Ревью 1.2.2: смена видимости категории синхронизирует индекс подсказки (через очередь; в тестах синхронно).

beforeEach(function () {
    MeilisearchIndex::reset();
});

function indexedKeysFor(string $query): int
{
    return InstrumentModel::search($query)->keys()->count();
}

it('скрытие категории убирает её модели из индекса, показ возвращает active-модели', function () {
    $category = Category::factory()->create(['name' => 'Гитары', 'slug' => 'gitary-vis', 'is_visible' => true]);
    InstrumentModel::factory()->for($category, 'category')->create(['brand' => 'Gibson', 'name' => 'Les Paul Studio']);
    MeilisearchIndex::waitForTasks();
    expect(indexedKeysFor('Gibson'))->toBe(1);

    $category->update(['is_visible' => false]);
    MeilisearchIndex::waitForTasks();
    expect(indexedKeysFor('Gibson'))->toBe(0);

    $category->update(['is_visible' => true]);
    MeilisearchIndex::waitForTasks();
    expect(indexedKeysFor('Gibson'))->toBe(1);
});

it('скрытие родительской категории убирает модели дочерней из индекса', function () {
    $parent = Category::factory()->create(['name' => 'Гитары', 'slug' => 'gitary-tree', 'is_visible' => true]);
    $child = Category::factory()->for($parent, 'parent')->create(['name' => 'Бас', 'slug' => 'bass-tree', 'is_visible' => true]);
    InstrumentModel::factory()->for($child, 'category')->create(['brand' => 'Fender', 'name' => 'Player Precision Bass']);
    MeilisearchIndex::waitForTasks();
    expect(indexedKeysFor('Precision'))->toBe(1);

    $parent->update(['is_visible' => false]);
    MeilisearchIndex::waitForTasks();

    expect(indexedKeysFor('Precision'))->toBe(0);
});

it('скрытая категория не добавляет в индекс модели, которые стали active', function () {
    $category = Category::factory()->hidden()->create(['name' => 'Архив', 'slug' => 'arkhiv-vis']);
    $model = InstrumentModel::factory()->for($category, 'category')->create(['brand' => 'Boss', 'name' => 'DS-1 Distortion']);
    MeilisearchIndex::waitForTasks();
    expect(indexedKeysFor('Distortion'))->toBe(0);

    $model->update(['status' => InstrumentModelStatus::Active]);
    MeilisearchIndex::waitForTasks();

    expect(indexedKeysFor('Distortion'))->toBe(0);
});
