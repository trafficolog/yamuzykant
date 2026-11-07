<?php

declare(strict_types=1);

use Database\Seeders\FleaDemoSeeder;

// Демо-сидер пишет в БД и индекс: работает только в local, testing и e2e, а не «везде кроме production».

it('в окружении :env сидер отказывается запускаться', function (string $environment) {
    app()->detectEnvironment(fn (): string => $environment);

    expect(fn () => (new FleaDemoSeeder)->run())->toThrow(RuntimeException::class);
})->with(['production', 'staging', 'stage']);
