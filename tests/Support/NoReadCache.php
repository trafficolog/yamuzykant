<?php

declare(strict_types=1);

namespace Tests\Support;

use Illuminate\Cache\ArrayStore;
use Illuminate\Cache\RateLimiter;
use Illuminate\Cache\Repository;
use Illuminate\Support\Facades\RateLimiter as RateLimiterFacade;
use LogicException;

/**
 * Хранилище счётчиков, из которого приложение не может прочитать значение: только атомарно добавить
 * ключ и увеличить его. Код, который сначала проверяет счётчик, а потом увеличивает (ревью PR #119, #126),
 * падает на первом чтении: между проверкой и увеличением параллельный запрос успевает пройти сверх лимита.
 */
final class NoReadCache extends Repository
{
    public static function install(): void
    {
        $store = new class extends ArrayStore
        {
            /** Атомарное «добавить, если нет» — как SETNX в Redis. */
            public function add($key, $value, $seconds)
            {
                if (parent::get($key) !== null) {
                    return false;
                }

                return $this->put($key, $value, $seconds);
            }
        };

        app()->singleton(RateLimiter::class, fn (): RateLimiter => new RateLimiter(new self($store)));
        RateLimiterFacade::clearResolvedInstances();
    }

    public function get($key, $default = null): mixed
    {
        throw new LogicException('Чтение счётчика до увеличения: проверка и увеличение не атомарны.');
    }
}
