<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;

it('создаёт таблицы справочников с нужными колонками', function () {
    expect(Schema::hasColumns('categories', ['id', 'parent_id', 'name', 'slug', 'icon', 'sort_order', 'is_visible']))->toBeTrue()
        ->and(Schema::hasColumns('instrument_models', ['id', 'brand', 'name', 'year_from', 'year_to', 'category_id', 'status']))->toBeTrue()
        ->and(Schema::hasColumns('cities', ['id', 'name', 'region', 'lat', 'lng']))->toBeTrue();
});

it('миграции обратимы: откат удаляет таблицы, повторный прогон возвращает', function () {
    Artisan::call('migrate:rollback', ['--step' => 3]);

    expect(Schema::hasTable('categories'))->toBeFalse()
        ->and(Schema::hasTable('instrument_models'))->toBeFalse()
        ->and(Schema::hasTable('cities'))->toBeFalse();

    Artisan::call('migrate');

    expect(Schema::hasTable('categories'))->toBeTrue()
        ->and(Schema::hasTable('instrument_models'))->toBeTrue()
        ->and(Schema::hasTable('cities'))->toBeTrue();
});
