<?php

declare(strict_types=1);

use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\City;
use App\Domain\Catalog\Models\InstrumentModel;
use App\Http\Resources\Catalog\CityResource;
use App\Http\Resources\Catalog\InstrumentModelResource;
use Illuminate\Http\Request;

it('модель отдаётся с явным списком полей и без статуса и служебных полей', function () {
    $category = Category::factory()->create();
    $model = InstrumentModel::factory()->for($category, 'category')->create([
        'brand' => 'Fender', 'name' => 'Player Stratocaster', 'year_from' => 2018, 'year_to' => null,
    ]);

    $data = (new InstrumentModelResource($model))->toArray(new Request);

    expect($data)->toBe([
        'id' => $model->id,
        'brand' => 'Fender',
        'name' => 'Player Stratocaster',
        'year_from' => 2018,
        'year_to' => null,
        'category_id' => $category->id,
    ]);
});

it('город отдаётся с явным списком полей', function () {
    $city = City::factory()->create(['name' => 'Казань', 'region' => 'Республика Татарстан', 'lat' => 55.7887, 'lng' => 49.1221]);

    expect((new CityResource($city))->toArray(new Request))->toBe([
        'id' => $city->id,
        'name' => 'Казань',
        'region' => 'Республика Татарстан',
        'lat' => 55.7887,
        'lng' => 49.1221,
    ]);
});

it('публичная коллекция моделей не содержит предложенных и скрытых', function () {
    $category = Category::factory()->create();
    InstrumentModel::factory()->for($category, 'category')->create(['brand' => 'Boss', 'name' => 'DS-1 Distortion']);
    InstrumentModel::factory()->for($category, 'category')->suggested()->create(['brand' => 'Boss', 'name' => 'DS1']);
    InstrumentModel::factory()->for($category, 'category')->hiddenStatus()->create(['brand' => 'Boss', 'name' => 'DS-2']);

    $rows = InstrumentModelResource::collection(InstrumentModel::query()->public()->get())
        ->toArray(new Request);

    expect($rows)->toHaveCount(1)
        ->and($rows[0]['name'])->toBe('DS-1 Distortion');
});
