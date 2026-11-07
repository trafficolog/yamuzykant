<?php

declare(strict_types=1);

use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\InstrumentModel;
use Illuminate\Database\QueryException;

// Ревью PR #85 и #92: уникальность корневых категорий и пары (brand, name) без учёта регистра.

it('две корневые категории с одним slug — ошибка БД', function () {
    Category::factory()->create(['parent_id' => null, 'slug' => 'gitary-root']);

    Category::factory()->create(['parent_id' => null, 'slug' => 'gitary-root']);
})->throws(QueryException::class);

it('одинаковый slug у дочерних категорий разных родителей допустим', function () {
    $first = Category::factory()->create(['parent_id' => null, 'slug' => 'vid-a']);
    $second = Category::factory()->create(['parent_id' => null, 'slug' => 'vid-b']);

    Category::factory()->create(['parent_id' => $first->id, 'slug' => 'obshchee']);
    Category::factory()->create(['parent_id' => $second->id, 'slug' => 'obshchee']);

    expect(Category::query()->where('slug', 'obshchee')->count())->toBe(2);
});

it('бренд и название уникальны без учёта регистра', function () {
    InstrumentModel::factory()->create(['brand' => 'Boss', 'name' => 'DS-1 Distortion']);

    InstrumentModel::factory()->create(['brand' => 'boss', 'name' => 'ds-1 DISTORTION']);
})->throws(QueryException::class);
