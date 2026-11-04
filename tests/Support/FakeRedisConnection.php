<?php

declare(strict_types=1);

namespace Tests\Support;

use Closure;
use Illuminate\Redis\Connections\Connection;
use RuntimeException;

/**
 * Подмена соединения Redis для проверок /health: ping() и lindex() без сервера.
 */
final class FakeRedisConnection extends Connection
{
    public function __construct(private readonly bool $pingFails = false, private readonly ?string $oldestPayload = null) {}

    /**
     * @param  string  $method
     * @param  array<int, mixed>  $parameters
     */
    public function command($method, array $parameters = []): mixed
    {
        return match (strtolower($method)) {
            'ping' => $this->pingFails ? throw new RuntimeException('connection refused') : 'PONG',
            'lindex' => $this->oldestPayload,
            default => null,
        };
    }

    /**
     * @param  array<int, string>|string  $channels
     */
    public function createSubscription($channels, Closure $callback, $method = 'subscribe'): void {}
}
