<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::fake(['*/health' => Http::response(['status' => 'available'])]);
    config(['queue.default' => 'database']);
});

it('очередь в БД: пустая — ok, возраст 0', function () {
    $this->getJson('/health')
        ->assertOk()
        ->assertJsonPath('checks.queue.status', 'ok')
        ->assertJsonPath('checks.queue.oldest_age_seconds', 0);
});

it('очередь в БД: задание старше 5 минут — 200 и degraded', function () {
    DB::table('jobs')->insert([
        'queue' => 'default', 'payload' => '{}', 'attempts' => 0,
        'reserved_at' => null, 'available_at' => time() - 600, 'created_at' => time() - 600,
    ]);

    $this->getJson('/health')
        ->assertOk()
        ->assertJsonPath('status', 'degraded')
        ->assertJsonPath('checks.queue.status', 'fail');
});
