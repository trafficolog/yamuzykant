<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Pennant\Feature;

// Список из карточки 0.1.6 и SCREENS.md §2; `premoderation` — SPEC §6.1, ARCHITECTURE §7.
dataset('feature_flags', [
    'catalog_new',
    'masters',
    'sale_prices',
    'accessories',
    'companies',
    'wallet',
    'safe_deal',
    'r1_public',
    'premoderation',
]);

it('хранит флаги в драйвере database', function () {
    expect(config('pennant.default'))->toBe('database');
    expect(Schema::hasTable('features'))->toBeTrue();
});

it('все флаги выключены по умолчанию', function (string $flag) {
    expect(Feature::for(null)->active($flag))->toBeFalse();
})->with('feature_flags');

it('shared prop flags отдаёт явный список флагов, все false по умолчанию', function () {
    $this->get('/')
        ->assertInertia(fn (Assert $page) => $page->where('flags', [
            'catalog_new' => false,
            'masters' => false,
            'sale_prices' => false,
            'accessories' => false,
            'companies' => false,
            'wallet' => false,
            'safe_deal' => false,
            'r1_public' => false,
            'premoderation' => false,
        ]));
});

it('включение и выключение флага в БД меняет shared prop без деплоя', function () {
    Feature::for(null)->activate('masters');

    $this->get('/')->assertInertia(fn (Assert $page) => $page->where('flags.masters', true));

    Feature::for(null)->deactivate('masters');

    $this->get('/')->assertInertia(fn (Assert $page) => $page->where('flags.masters', false));
});

it('миграция Pennant обратима', function () {
    $files = glob(database_path('migrations/*_create_features_table.php')) ?: [];
    expect($files)->toHaveCount(1);

    $migration = require $files[0];

    $migration->down();
    expect(Schema::hasTable('features'))->toBeFalse();

    $migration->up();
    expect(Schema::hasTable('features'))->toBeTrue();
    expect(DB::table('features')->count())->toBe(0);
});
