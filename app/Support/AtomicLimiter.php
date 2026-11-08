<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Support\Facades\RateLimiter;

/**
 * Лимит обращений с атомарным счётчиком: сначала увеличить, потом сравнить (ревью PR #119, #126).
 *
 * `RateLimiter::attempt()` и `ThrottleRequests` сначала читают счётчик, потом увеличивают: параллельные запросы
 * читают одно значение и проходят сверх лимита. Здесь единственная операция над счётчиком — атомарное увеличение
 * (INCRBY в Redis, `RateLimiter::increment`), а решение принимается по числу, которое она вернула.
 * Отклонённое обращение тоже остаётся в счётчике: окно не сдвигается, повторять нет смысла до его конца.
 */
final class AtomicLimiter
{
    /** @return bool true — обращение в пределах лимита */
    public function hit(string $key, int $max, int $decaySeconds): bool
    {
        return RateLimiter::increment($key, $decaySeconds) <= $max;
    }

    /** Через сколько секунд окно счётчика закончится. */
    public function availableIn(string $key): int
    {
        return RateLimiter::availableIn($key);
    }
}
