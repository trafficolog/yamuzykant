<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Models\City;
use Database\Seeders\CitySeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia;

// Решение OWNER 08.11.2026: названия городов не склоняем, перед названием — тип населённого пункта:
// «Встреча в г. Москва». Тип хранится в справочнике городов (cities.settlement_type, по умолчанию «г.»).

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('в справочнике городов есть колонка settlement_type', function () {
    expect(Schema::hasColumn('cities', 'settlement_type'))->toBeTrue();
});

it('город, созданный без типа, получает «г.»', function () {
    DB::table('cities')->insert([
        'name' => 'Тверь', 'region' => 'Тверская область', 'slug' => 'tver',
        'lat' => 56.8587, 'lng' => 35.9176, 'created_at' => now(), 'updated_at' => now(),
    ]);

    expect(DB::table('cities')->where('slug', 'tver')->value('settlement_type'))->toBe('г.');
});

it('миграция обратима: после отката колонки нет, после повтора она на месте', function () {
    $migration = require database_path('migrations/2026_11_08_100000_add_settlement_type_to_cities.php');

    $migration->down();
    expect(Schema::hasColumn('cities', 'settlement_type'))->toBeFalse();

    $migration->up();
    expect(Schema::hasColumn('cities', 'settlement_type'))->toBeTrue();
});

it('сидер проставляет «г.» всем городам-миллионникам', function () {
    $this->seed(CitySeeder::class);

    expect(City::query()->count())->toBeGreaterThanOrEqual(16)
        ->and(City::query()->where('settlement_type', '!=', 'г.')->count())->toBe(0)
        ->and(City::query()->where('name', 'Москва')->value('settlement_type'))->toBe('г.');
});

it('повторный сидер не затирает тип, заданный вручную у города вне списка', function () {
    $city = City::factory()->create(['settlement_type' => 'пос.']);

    $this->seed(CitySeeder::class);

    expect($city->fresh()?->settlement_type)->toBe('пос.');
});

it('страница «Продать» отдаёт тип и название города шапки', function () {
    $this->seed(CitySeeder::class);

    $this->actingAs(User::factory()->create())->get('/sell')
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('place', ['type' => 'г.', 'name' => 'Москва']));
});

it('город с другим типом: «пос.» уходит на страницу вместе с названием', function () {
    $city = City::factory()->create(['name' => 'Заречье', 'settlement_type' => 'пос.']);

    $this->actingAs(User::factory()->create(['city_id' => $city->id]))->get('/sell')
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('place', ['type' => 'пос.', 'name' => 'Заречье']));
});

it('без города в справочнике place = null', function () {
    $this->actingAs(User::factory()->create())->get('/sell')
        ->assertInertia(fn (AssertableInertia $page) => $page->where('place', null));
});

it('общий shared prop city остаётся прежним: id и name, без типа (шапка не меняется)', function () {
    $this->seed(CitySeeder::class);

    $this->actingAs(User::factory()->create())->get('/sell')
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('city.name', 'Москва')
            ->missing('city.settlement_type'));
});
