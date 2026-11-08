<?php

declare(strict_types=1);

namespace Tests\Support;

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
        $store = new AtomicArrayStore;

        app()->singleton(RateLimiter::class, fn (): RateLimiter => new RateLimiter(new self($store)));
        RateLimiterFacade::clearResolvedInstances();
    }

    /**
     * @param  \UnitEnum|string  $key
     * @param  mixed  $default
     */
    public function get($key, $default = null): mixed
    {
        // Время до конца окна (Retry-After) читается уже после решения по счётчику — это безопасно.
        if (is_string($key) && str_ends_with($key, ':timer')) {
            return parent::get($key, $default);
        }

        throw new LogicException('Чтение счётчика до увеличения: проверка и увеличение не атомарны.');
    }
}
