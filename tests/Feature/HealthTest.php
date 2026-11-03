<?php

declare(strict_types=1);

it('/health отвечает 200 и {"status":"ok"}', function () {
    $this->getJson('/health')
        ->assertOk()
        ->assertExactJson(['status' => 'ok']);
});

it('/health отвечает быстрее 50 мс', function () {
    $this->getJson('/health')->assertOk(); // прогрев: загрузка маршрутов и контейнера

    $durations = [];
    foreach (range(1, 5) as $_) {
        $start = hrtime(true);
        $this->getJson('/health')->assertOk();
        $durations[] = (hrtime(true) - $start) / 1_000_000;
    }

    expect(min($durations))->toBeLessThan(50.0);
});

it('/health не зависит от базы данных и сессии', function () {
    config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => '/nonexistent/db.sqlite']);

    $this->getJson('/health')->assertOk();
});
