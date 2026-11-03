<?php

declare(strict_types=1);

use App\Domain\Catalog\Models\Category;
use Inertia\Testing\AssertableInertia as Assert;

it('публичные props содержат только видимые категории (скрытая и её потомки не уходят на фронт)', function () {
    $guitars = Category::factory()->create(['name' => 'Гитары', 'slug' => 'gitary', 'sort_order' => 1]);
    Category::factory()->for($guitars, 'parent')->create(['name' => 'Электрогитары', 'slug' => 'elektrogitary']);
    $accessories = Category::factory()->hidden()->create(['name' => 'Аксессуары и запчасти', 'slug' => 'aksessuary', 'sort_order' => 2]);
    Category::factory()->for($accessories, 'parent')->create(['name' => 'Струны', 'slug' => 'struny']);

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('categories', 1)
            ->where('categories.0.name', 'Гитары')
            ->has('categories.0.children', 1)
            ->where('categories.0.children.0.name', 'Электрогитары'));

    $this->get('/')->assertDontSee('Аксессуары и запчасти')->assertDontSee('Струны');
});

it('категория отдаётся с явным списком полей без служебных', function () {
    $guitars = Category::factory()->create(['name' => 'Гитары', 'slug' => 'gitary', 'icon' => 'guitar']);
    Category::factory()->for($guitars, 'parent')->create(['name' => 'Электрогитары', 'slug' => 'elektrogitary']);

    $props = $this->get('/')->viewData('page')['props'];
    $kind = $props['categories'][0];

    expect(array_keys($kind))->toBe(['id', 'name', 'slug', 'icon', 'children'])
        ->and(array_keys($kind['children'][0]))->toBe(['id', 'name', 'slug', 'icon', 'children']);
});

it('если скрытую категорию показать, она сразу появляется в props', function () {
    $category = Category::factory()->hidden()->create(['name' => 'Духовые']);

    $this->get('/')->assertInertia(fn (Assert $page) => $page->has('categories', 0));

    $category->update(['is_visible' => true]);

    $this->get('/')->assertInertia(fn (Assert $page) => $page->has('categories', 1)->where('categories.0.name', 'Духовые'));
});
