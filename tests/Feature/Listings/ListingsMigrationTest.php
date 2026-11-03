<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

const LISTING_TABLES = ['listings', 'listing_photos', 'sale_records', 'moderation_decisions'];

/** Первая колонка каждого индекса таблицы: по ней индекс работает для фильтра и FK. */
function leadingIndexColumns(string $table): array
{
    return array_map(fn (array $index): string => $index['columns'][0], Schema::getIndexes($table));
}

it('listings — поля SPEC §7', function () {
    expect(Schema::getColumnListing('listings'))->toEqualCanonicalizing([
        'id', 'user_id', 'status', 'category_id', 'model_id', 'title', 'year', 'serial_enc', 'condition',
        'description', 'price', 'negotiable', 'meet', 'ship', 'city_id', 'published_at', 'created_at', 'updated_at',
    ]);
});

it('listing_photos, sale_records, moderation_decisions — со своими полями', function () {
    expect(Schema::hasColumns('listing_photos', ['id', 'listing_id', 'path', 'position', 'is_serial']))->toBeTrue()
        ->and(Schema::hasColumns('sale_records', ['listing_id', 'reason', 'final_price', 'sold_at']))->toBeTrue()
        ->and(Schema::hasColumns('moderation_decisions', ['id', 'listing_id', 'verdict', 'reason', 'staff_id', 'created_at']))->toBeTrue();
});

it('индексы на внешних ключах, статусе, городе, категории, цене, published_at', function () {
    expect(leadingIndexColumns('listings'))->toContain('user_id', 'status', 'category_id', 'model_id', 'city_id', 'price', 'published_at')
        ->and(leadingIndexColumns('listing_photos'))->toContain('listing_id')
        ->and(leadingIndexColumns('sale_records'))->toContain('listing_id')
        ->and(leadingIndexColumns('moderation_decisions'))->toContain('listing_id');
});

it('внешние ключи listings — на users, categories, instrument_models, cities', function () {
    $targets = collect(Schema::getForeignKeys('listings'))
        ->mapWithKeys(fn (array $fk): array => [$fk['columns'][0] => $fk['foreign_table']])
        ->all();

    expect($targets)->toMatchArray([
        'user_id' => 'users',
        'category_id' => 'categories',
        'model_id' => 'instrument_models',
        'city_id' => 'cities',
    ]);

    foreach (['listing_photos', 'sale_records', 'moderation_decisions'] as $table) {
        expect(collect(Schema::getForeignKeys($table))->pluck('foreign_table')->all())->toContain('listings');
    }
});

it('миграции объявлений обратимы: откат удаляет таблицы, повторный прогон возвращает', function () {
    $steps = DB::table('migrations')->where('migration', '>=', '2026_11_04_100000')->count();
    expect($steps)->toBeGreaterThanOrEqual(4);

    Artisan::call('migrate:rollback', ['--step' => $steps]);

    foreach (LISTING_TABLES as $table) {
        expect(Schema::hasTable($table))->toBeFalse();
    }

    Artisan::call('migrate');

    foreach (LISTING_TABLES as $table) {
        expect(Schema::hasTable($table))->toBeTrue();
    }
});
