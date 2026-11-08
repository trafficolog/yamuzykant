<?php

declare(strict_types=1);

use App\Support\AtomicLimiter;
use Tests\Support\NoReadCache;

// 4.1.3 (ревью PR #119, #126): счётчик лимита атомарный — сначала увеличить, потом сравнить.

it('пропускает ровно max обращений за окно, остальные отклоняет', function () {
    $limiter = new AtomicLimiter;
    $allowed = 0;

    foreach (range(1, 50) as $ignored) {
        $allowed += $limiter->hit('test:exact', 30, 60) ? 1 : 0;
    }

    expect($allowed)->toBe(30);
});

it('никогда не читает счётчик до увеличения: параллельные запросы не проходят сверх лимита', function () {
    NoReadCache::install();
    $limiter = new AtomicLimiter;

    $results = array_map(fn (): bool => $limiter->hit('test:no-read', 5, 60), range(1, 12));

    expect(array_sum(array_map('intval', $results)))->toBe(5);
});

it('окно истекает: после него счёт идёт заново', function () {
    $limiter = new AtomicLimiter;
    foreach (range(1, 3) as $ignored) {
        $limiter->hit('test:window', 3, 60);
    }
    expect($limiter->hit('test:window', 3, 60))->toBeFalse();

    $this->travel(61)->seconds();

    expect($limiter->hit('test:window', 3, 60))->toBeTrue();
});

it('сообщает, через сколько секунд лимит откроется', function () {
    $limiter = new AtomicLimiter;
    $limiter->hit('test:retry', 1, 60);
    $limiter->hit('test:retry', 1, 60);

    expect($limiter->availableIn('test:retry'))->toBeGreaterThan(0)->toBeLessThanOrEqual(60);
});

it('ключи разных пользователей независимы', function () {
    $limiter = new AtomicLimiter;
    $limiter->hit('test:a', 1, 60);

    expect($limiter->hit('test:a', 1, 60))->toBeFalse()
        ->and($limiter->hit('test:b', 1, 60))->toBeTrue();
});
