<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::fake(fn () => Http::response(['status' => 'available']));
    config(['queue.default' => 'database']);
});

it('очередь в БД: отложенное задание (available_at в будущем) не даёт degraded', function () {
    DB::table('jobs')->insert([
        'queue' => 'default', 'payload' => '{}', 'attempts' => 1,
        'reserved_at' => null, 'available_at' => time() + 600, 'created_at' => time() - 3600,
    ]);

    $this->getJson('/health')
        ->assertOk()
        ->assertJsonPath('status', 'ok')
        ->assertJsonPath('checks.queue.oldest_age_seconds', 0);
});

it('очередь в БД: возраст считается от available_at, а не от created_at', function () {
    DB::table('jobs')->insert([
        'queue' => 'default', 'payload' => '{}', 'attempts' => 0,
        'reserved_at' => null, 'available_at' => time() - 20, 'created_at' => time() - 3600,
    ]);

    $this->getJson('/health')
        ->assertOk()
        ->assertJsonPath('status', 'ok')
        ->assertJsonPath('checks.queue.status', 'ok');
});
