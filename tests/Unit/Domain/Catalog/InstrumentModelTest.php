<?php

declare(strict_types=1);

use App\Domain\Catalog\Enums\InstrumentModelStatus;
use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\InstrumentModel;
use Illuminate\Database\QueryException;

it('статус модели — active, suggested или hidden', function () {
    expect(array_map(fn (InstrumentModelStatus $s) => $s->value, InstrumentModelStatus::cases()))
        ->toBe(['active', 'suggested', 'hidden']);
});

it('по умолчанию модель активна, статус приводится к enum', function () {
    $model = InstrumentModel::factory()->create();

    expect($model->refresh()->status)->toBe(InstrumentModelStatus::Active);
});

it('публичный список — только active в видимых категориях', function () {
    $visible = Category::factory()->create();
    $hidden = Category::factory()->hidden()->create();
    $child = Category::factory()->for($hidden, 'parent')->create();

    InstrumentModel::factory()->for($visible, 'category')->create(['brand' => 'Fender', 'name' => 'Player Stratocaster']);
    InstrumentModel::factory()->for($visible, 'category')->suggested()->create(['brand' => 'Ibanez', 'name' => 'AZ2204']);
    InstrumentModel::factory()->for($visible, 'category')->hiddenStatus()->create(['brand' => 'Boss', 'name' => 'Old']);
    InstrumentModel::factory()->for($hidden, 'category')->create(['brand' => 'Dunlop', 'name' => 'Strings']);
    InstrumentModel::factory()->for($child, 'category')->create(['brand' => 'Elixir', 'name' => 'Nanoweb']);

    $public = InstrumentModel::query()->public()->get();

    expect($public->map(fn (InstrumentModel $m) => $m->fullName())->all())
        ->toBe(['Fender Player Stratocaster']);
});

it('бренд и название уникальны в паре', function () {
    InstrumentModel::factory()->create(['brand' => 'Boss', 'name' => 'DS-1 Distortion']);

    InstrumentModel::factory()->create(['brand' => 'Boss', 'name' => 'DS-1 Distortion']);
})->throws(QueryException::class);

it('полное название собирается из бренда и названия', function () {
    $model = InstrumentModel::factory()->make(['brand' => 'Fender', 'name' => 'Player Stratocaster']);

    expect($model->fullName())->toBe('Fender Player Stratocaster');
});

it('годы выпуска — целые числа или null', function () {
    $model = InstrumentModel::factory()->create(['year_from' => 2018, 'year_to' => null]);

    expect($model->refresh()->year_from)->toBe(2018)
        ->and($model->year_to)->toBeNull();
});
