<?php

declare(strict_types=1);

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Тесты PHP не должны зависеть от собранных Vite-бандлов (public/build).
        $this->withoutVite();

        // Окружение из .env (pgsql из compose) не должно попадать в SQLite-тесты: они идут в памяти.
        config(['database.connections.sqlite.database' => ':memory:']);
    }
}
