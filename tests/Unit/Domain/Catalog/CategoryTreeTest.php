<?php

declare(strict_types=1);

use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Queries\CategoryTree;

it('собирает дерево в три уровня и сортирует по sort_order, а не по id', function () {
    $second = Category::factory()->create(['name' => 'Педали и усилители', 'sort_order' => 2]);
    $first = Category::factory()->create(['name' => 'Гитары', 'sort_order' => 1]);
    Category::factory()->for($first, 'parent')->create(['name' => 'Бас-гитары', 'sort_order' => 2]);
    $groupA = Category::factory()->for($first, 'parent')->create(['name' => 'Электрогитары', 'sort_order' => 1]);
    Category::factory()->for($groupA, 'parent')->create(['name' => 'Telecaster-тип', 'sort_order' => 2]);
    Category::factory()->for($groupA, 'parent')->create(['name' => 'Stratocaster-тип', 'sort_order' => 1]);

    $tree = (new CategoryTree)->all();

    expect($tree->pluck('name')->all())->toBe(['Гитары', 'Педали и усилители'])
        ->and($tree[0]->children->pluck('name')->all())->toBe(['Электрогитары', 'Бас-гитары'])
        ->and($tree[0]->children[0]->children->pluck('name')->all())->toBe(['Stratocaster-тип', 'Telecaster-тип'])
        ->and($tree[1]->children)->toHaveCount(0)
        ->and($second->is($tree[1]))->toBeTrue();
});

it('публичное дерево без скрытой категории и всех её потомков', function () {
    $visible = Category::factory()->create(['name' => 'Гитары', 'sort_order' => 1]);
    $hidden = Category::factory()->hidden()->create(['name' => 'Аксессуары и запчасти', 'sort_order' => 2]);
    $hiddenGroup = Category::factory()->for($hidden, 'parent')->create(['name' => 'Струны']);
    Category::factory()->for($hiddenGroup, 'parent')->create(['name' => 'Для электрогитар']);
    Category::factory()->for($visible, 'parent')->create(['name' => 'Электрогитары']);

    $tree = (new CategoryTree)->public();

    expect($tree->pluck('name')->all())->toBe(['Гитары'])
        ->and($tree[0]->children->pluck('name')->all())->toBe(['Электрогитары']);
});

it('скрытая подкатегория исчезает, а соседние и родитель остаются', function () {
    $kind = Category::factory()->create(['name' => 'Гитары']);
    Category::factory()->for($kind, 'parent')->create(['name' => 'Электрогитары', 'sort_order' => 1]);
    Category::factory()->for($kind, 'parent')->hidden()->create(['name' => 'Укулеле', 'sort_order' => 2]);

    expect((new CategoryTree)->public()[0]->children->pluck('name')->all())->toBe(['Электрогитары'])
        ->and((new CategoryTree)->all()[0]->children->pluck('name')->all())->toBe(['Электрогитары', 'Укулеле']);
});

it('отдаёт идентификаторы видимых категорий для фильтрации моделей', function () {
    $kind = Category::factory()->create();
    $group = Category::factory()->for($kind, 'parent')->create();
    $hidden = Category::factory()->hidden()->create();
    $underHidden = Category::factory()->for($hidden, 'parent')->create();

    $ids = (new CategoryTree)->visibleIds();

    expect($ids)->toContain($kind->id, $group->id)
        ->and($ids)->not->toContain($hidden->id, $underHidden->id);
});

it('пустой справочник даёт пустое дерево', function () {
    expect((new CategoryTree)->public())->toHaveCount(0)
        ->and((new CategoryTree)->visibleIds())->toBe([]);
});
