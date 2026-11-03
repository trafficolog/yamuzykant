<?php

declare(strict_types=1);

use App\Domain\Catalog\Models\City;
use Illuminate\Database\QueryException;

it('координаты города приводятся к float', function () {
    $city = City::factory()->create(['name' => 'Москва', 'region' => 'Москва', 'lat' => 55.7558, 'lng' => 37.6173]);

    expect($city->refresh()->lat)->toBeFloat()->toBe(55.7558)
        ->and($city->lng)->toBeFloat()->toBe(37.6173);
});

it('город уникален в паре название + регион', function () {
    City::factory()->create(['name' => 'Тверь', 'region' => 'Тверская область']);

    City::factory()->create(['name' => 'Тверь', 'region' => 'Тверская область']);
})->throws(QueryException::class);

it('упорядочивается по названию', function () {
    City::factory()->create(['name' => 'Уфа']);
    City::factory()->create(['name' => 'Казань']);

    expect(City::query()->ordered()->pluck('name')->all())->toBe(['Казань', 'Уфа']);
});
