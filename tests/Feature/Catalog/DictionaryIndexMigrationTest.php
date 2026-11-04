<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;

// Ревью 1.2.3 (неблокирующее): миграция уникальности не падает на дублях без понятного сообщения.

it('дубли (brand, name) без учёта регистра блокируют миграцию с понятной ошибкой и перечнем строк', function () {
    $migration = require database_path('migrations/2026_11_04_100000_add_unique_indexes_for_dictionaries.php');
    $migration->down();

    $categoryId = DB::table('categories')->insertGetId([
        'name' => 'Гитары', 'slug' => 'gitary-dup', 'sort_order' => 1, 'is_visible' => true,
        'created_at' => now(), 'updated_at' => now(),
    ]);
    $first = DB::table('instrument_models')->insertGetId([
        'brand' => 'Fender', 'name' => 'Stratocaster', 'category_id' => $categoryId, 'status' => 'active',
        'created_at' => now(), 'updated_at' => now(),
    ]);
    $second = DB::table('instrument_models')->insertGetId([
        'brand' => 'fender', 'name' => 'STRATOCASTER', 'category_id' => $categoryId, 'status' => 'suggested',
        'created_at' => now(), 'updated_at' => now(),
    ]);

    $message = null;
    try {
        $migration->up();
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
    }

    expect($message)->not->toBeNull()
        ->and($message)->toContain('дубли', (string) $first, (string) $second);

    // Предпроверка идёт до создания индексов: после устранения дубля миграция проходит целиком.
    DB::table('instrument_models')->where('id', $second)->delete();
    $migration->up();

    expect(DB::table('instrument_models')->count())->toBe(1);
});
