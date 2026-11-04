<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;

// Ревью 1.1.4: города, заполненные до появления slug, получают slug миграцией (деплой миграции запускает, сиды — нет).

/** @return array<string, mixed> */
function cityRow(string $name, string $region, ?string $slug): array
{
    return [
        'name' => $name,
        'region' => $region,
        'slug' => $slug,
        'lat' => 55.0,
        'lng' => 37.0,
        'created_at' => now(),
        'updated_at' => now(),
    ];
}

it('миграция проставляет slug городам-миллионникам без slug и не трогает уже заданные', function () {
    DB::table('cities')->insert([
        cityRow('Москва', 'Москва', null),
        cityRow('Санкт-Петербург', 'Санкт-Петербург', null),
        cityRow('Казань', 'Республика Татарстан', null),
        cityRow('Тверь', 'Тверская область', 'tver-custom'),
    ]);

    $migration = require database_path('migrations/2026_11_04_100200_backfill_city_slugs.php');
    $migration->up();

    expect(DB::table('cities')->where('name', 'Москва')->value('slug'))->toBe('moscow')
        ->and(DB::table('cities')->where('name', 'Санкт-Петербург')->value('slug'))->toBe('saint-petersburg')
        ->and(DB::table('cities')->where('name', 'Казань')->value('slug'))->toBe('kazan')
        ->and(DB::table('cities')->where('name', 'Тверь')->value('slug'))->toBe('tver-custom');
});

it('повторный запуск миграции не меняет уже проставленные slug', function () {
    DB::table('cities')->insert([cityRow('Москва', 'Москва', null)]);

    $migration = require database_path('migrations/2026_11_04_100200_backfill_city_slugs.php');
    $migration->up();
    $migration->up();
    expect(DB::table('cities')->where('name', 'Москва')->value('slug'))->toBe('moscow');

    DB::table('cities')->where('name', 'Москва')->update(['slug' => 'moscow-custom']);
    $migration->up();

    expect(DB::table('cities')->where('name', 'Москва')->value('slug'))->toBe('moscow-custom');
});

it('после миграции город по умолчанию находится по slug', function () {
    DB::table('cities')->insert([cityRow('Москва', 'Москва', null)]);

    $migration = require database_path('migrations/2026_11_04_100200_backfill_city_slugs.php');
    $migration->up();

    expect(DB::table('cities')->where('slug', config('city.default_slug'))->value('name'))->toBe('Москва');
});
