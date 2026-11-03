<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

it('создаёт таблицы справочников с нужными колонками', function () {
    expect(Schema::hasColumns('categories', ['id', 'parent_id', 'name', 'slug', 'icon', 'sort_order', 'is_visible']))->toBeTrue()
        ->and(Schema::hasColumns('instrument_models', ['id', 'brand', 'name', 'year_from', 'year_to', 'category_id', 'status']))->toBeTrue()
        ->and(Schema::hasColumns('cities', ['id', 'name', 'region', 'lat', 'lng']))->toBeTrue();
});

it('миграции обратимы: откат удаляет таблицы, повторный прогон возвращает', function () {
    // Откатываем справочники и все миграции после них (например, users.city_id → cities из 1.1.1).
    $steps = DB::table('migrations')->where('migration', '>=', '2026_11_03_100000')->count();
    Artisan::call('migrate:rollback', ['--step' => $steps]);

    expect(Schema::hasTable('categories'))->toBeFalse()
        ->and(Schema::hasTable('instrument_models'))->toBeFalse()
        ->and(Schema::hasTable('cities'))->toBeFalse();

    Artisan::call('migrate');

    expect(Schema::hasTable('categories'))->toBeTrue()
        ->and(Schema::hasTable('instrument_models'))->toBeTrue()
        ->and(Schema::hasTable('cities'))->toBeTrue();
});
