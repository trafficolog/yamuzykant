<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;

// Каркас тестов: SQLite-тесты идут в памяти, даже если DB_DATABASE из .env указывает на файл
// (раньше RefreshDatabase мигрировал файл `ymuzykant` в корне до переключения на :memory:).

it('соединение sqlite в тестах работает в памяти, файл в корне не создаётся', function () {
    expect(DB::connection('sqlite')->getDatabaseName())->toBe(':memory:')
        ->and(is_file(base_path('ymuzykant')))->toBeFalse();
});
