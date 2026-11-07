<?php

declare(strict_types=1);

namespace Tests\Support;

use Closure;
use Illuminate\Redis\Connections\Connection;
use RuntimeException;

/**
 * Подмена соединения Redis для проверок /health: ping() и lrange() без сервера.
 */
final class FakeRedisConnection extends Connection
{
    /** @var list<string> ключи списков, которые запрашивались через lrange */
    public static array $listKeys = [];

    public function __construct(private readonly bool $pingFails = false, private readonly ?string $oldestPayload = null) {}

    /**
     * @param  string  $method
     * @param  array<int, mixed>  $parameters
     */
    public function command($method, array $parameters = []): mixed
    {
        if (strtolower($method) === 'lrange') {
            self::$listKeys[] = (string) $parameters[0];

            return $this->oldestPayload === null ? [] : [$this->oldestPayload];
        }

        return match (strtolower($method)) {
            'ping' => $this->pingFails ? throw new RuntimeException('connection refused') : 'PONG',
            default => null,
        };
    }

    /**
     * @param  array<int, string>|string  $channels
     */
    public function createSubscription($channels, Closure $callback, $method = 'subscribe'): void {}
}
