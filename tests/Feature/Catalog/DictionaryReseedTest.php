<?php

declare(strict_types=1);

use App\Domain\Catalog\Enums\InstrumentModelStatus;
use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\InstrumentModel;
use Database\Seeders\CatalogSeeder;

// Ревью 1.2.1 (п. 1): повторный сид не затирает решения сотрудников из консоли (is_visible, status).

beforeEach(function () {
    $this->seed(CatalogSeeder::class);
});

it('повторный db:seed не возвращает скрытый вид в видимые', function () {
    $kind = Category::query()->whereNull('parent_id')->where('name', 'Гитары')->firstOrFail();
    $kind->update(['is_visible' => false]);

    $this->seed(CatalogSeeder::class);

    expect($kind->refresh()->is_visible)->toBeFalse();
});

it('повторный db:seed не открывает скрытый по умолчанию вид «Аксессуары и запчасти»', function () {
    $accessories = Category::query()->whereNull('parent_id')->where('name', 'Аксессуары и запчасти')->firstOrFail();
    expect($accessories->is_visible)->toBeFalse();

    $accessories->update(['is_visible' => true]);
    $this->seed(CatalogSeeder::class);

    expect($accessories->refresh()->is_visible)->toBeTrue();
});

it('повторный db:seed не меняет скрытость подкатегории', function () {
    $item = Category::query()->where('name', 'Укулеле')->firstOrFail();
    $item->update(['is_visible' => false]);

    $this->seed(CatalogSeeder::class);

    expect($item->refresh()->is_visible)->toBeFalse();
});

it('повторный db:seed не возвращает статус модели из hidden в active', function () {
    $model = InstrumentModel::query()->where('brand', 'Boss')->where('name', 'DS-1 Distortion')->firstOrFail();
    $model->update(['status' => InstrumentModelStatus::Hidden]);

    $this->seed(CatalogSeeder::class);

    expect($model->refresh()->status)->toBe(InstrumentModelStatus::Hidden);
});

it('повторный db:seed не возвращает статус модели из suggested в active', function () {
    $model = InstrumentModel::query()->where('brand', 'Fender')->where('name', 'Player Telecaster')->firstOrFail();
    $model->update(['status' => InstrumentModelStatus::Suggested]);

    $this->seed(CatalogSeeder::class);

    expect($model->refresh()->status)->toBe(InstrumentModelStatus::Suggested);
});
