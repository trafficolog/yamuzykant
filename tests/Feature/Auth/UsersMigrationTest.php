<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

it('миграция users обратима', function () {
    // Откатываем миграцию users и все более поздние (например, listings → users из 2.1.1).
    $steps = DB::table('migrations')->where('migration', '>=', '2026_11_03_120000')->count();
    Artisan::call('migrate:rollback', ['--step' => $steps]);

    expect(Schema::hasColumn('users', 'password'))->toBeTrue()
        ->and(Schema::hasColumn('users', 'yandex_id'))->toBeFalse()
        ->and(Schema::hasColumn('users', 'city_id'))->toBeFalse()
        ->and(Schema::hasTable('password_reset_tokens'))->toBeTrue();

    Artisan::call('migrate');

    expect(Schema::hasColumns('users', ['yandex_id', 'city_id', 'consent_version', 'session_version']))->toBeTrue()
        ->and(Schema::hasColumn('users', 'password'))->toBeFalse()
        ->and(Schema::hasTable('password_reset_tokens'))->toBeFalse();
});
