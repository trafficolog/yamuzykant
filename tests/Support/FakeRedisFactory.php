<?php

declare(strict_types=1);

namespace Tests\Support;

use Illuminate\Contracts\Redis\Factory;
use Illuminate\Redis\Connections\Connection;

final class FakeRedisFactory implements Factory
{
    public function __construct(private readonly Connection $connection) {}

    /**
     * @param  string|null  $name
     */
    public function connection($name = null): Connection
    {
        return $this->connection;
    }
}
