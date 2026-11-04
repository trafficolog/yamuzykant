<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Enums\InstrumentModelStatus;
use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\City;
use App\Domain\Catalog\Models\InstrumentModel;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\StateMachines\ListingStateMachine;

/**
 * Данные поисковых тестов: пример из прототипа — Fender ’57 Stratocaster за 184 500 ₽, Москва.
 */
final class ListingFixtures
{
    public static function city(string $name = 'Москва', float $lat = 55.7558, float $lng = 37.6173): City
    {
        return City::factory()->create([
            'name' => $name,
            'slug' => str($name)->slug()->toString().'-'.fake()->unique()->numberBetween(1, 99999),
            'lat' => $lat,
            'lng' => $lng,
        ]);
    }

    /** Гитары → Электрогитары. */
    public static function electricGuitars(): Category
    {
        $parent = Category::query()->firstOrCreate(
            ['parent_id' => null, 'slug' => 'gitary'],
            ['name' => 'Гитары', 'is_visible' => true],
        );

        return Category::query()->firstOrCreate(
            ['parent_id' => $parent->id, 'slug' => 'elektrogitary'],
            ['name' => 'Электрогитары', 'is_visible' => true],
        );
    }

    /** Педали и усилители → Педали эффектов (вторая ветка дерева). */
    public static function pedals(): Category
    {
        $parent = Category::query()->firstOrCreate(
            ['parent_id' => null, 'slug' => 'pedali-i-usiliteli'],
            ['name' => 'Педали и усилители', 'is_visible' => true],
        );

        return Category::query()->firstOrCreate(
            ['parent_id' => $parent->id, 'slug' => 'pedali'],
            ['name' => 'Педали эффектов', 'is_visible' => true],
        );
    }

    public static function stratocaster(Category $category): InstrumentModel
    {
        return InstrumentModel::factory()->for($category, 'category')->create([
            'brand' => 'Fender',
            'name' => 'American Vintage ’57 Stratocaster',
            'status' => InstrumentModelStatus::Active,
        ]);
    }

    /**
     * Черновик с полным набором полей (без публикации).
     *
     * @param  array<string, mixed>  $attributes
     */
    public static function draft(array $attributes = [], ?City $city = null, ?Category $category = null): Listing
    {
        $category ??= self::electricGuitars();
        $city ??= self::city();

        $listing = new Listing;
        $listing->forceFill(['user_id' => User::factory()->create()->id]);
        $listing->fill(array_merge([
            'category_id' => $category->id,
            'model_id' => self::stratocaster($category)->id,
            'title' => 'Fender ’57 Stratocaster',
            'year' => 1957,
            'serial_enc' => 'V091234',
            'condition' => 'excellent',
            'description' => 'Родной кейс, оригинальные звукосниматели.',
            'price' => 184_500,
            'negotiable' => true,
            'meet' => true,
            'ship' => false,
            'city_id' => $city->id,
        ], $attributes));
        $listing->save();

        return $listing;
    }

    /**
     * Опубликованное через машину статусов (премодерация выключена): с событием и записью в индекс.
     *
     * @param  array<string, mixed>  $attributes
     */
    public static function published(array $attributes = [], ?City $city = null, ?Category $category = null): Listing
    {
        return app(ListingStateMachine::class)->publish(self::draft($attributes, $city, $category));
    }
}
