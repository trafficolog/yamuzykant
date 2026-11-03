<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;

it('миграция users обратима', function () {
    Artisan::call('migrate:rollback', ['--step' => 1]);

    expect(Schema::hasColumn('users', 'password'))->toBeTrue()
        ->and(Schema::hasColumn('users', 'yandex_id'))->toBeFalse()
        ->and(Schema::hasColumn('users', 'city_id'))->toBeFalse()
        ->and(Schema::hasTable('password_reset_tokens'))->toBeTrue();

    Artisan::call('migrate');

    expect(Schema::hasColumns('users', ['yandex_id', 'city_id', 'consent_version', 'session_version']))->toBeTrue()
        ->and(Schema::hasColumn('users', 'password'))->toBeFalse()
        ->and(Schema::hasTable('password_reset_tokens'))->toBeFalse();
});
