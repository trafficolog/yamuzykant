<?php

declare(strict_types=1);

use App\Domain\Listings\Enums\Condition;

it('состояние — ровно 8 ступеней BR-02 в порядке шкалы, значения как у ConditionBadge ДС', function () {
    expect(array_map(fn (Condition $c): string => $c->value, Condition::cases()))
        ->toBe(['new', 'mint', 'excellent', 'very-good', 'good', 'fair', 'poor', 'parts']);
});

it('подписи ступеней — из BR-02', function () {
    expect(array_map(fn (Condition $c): string => $c->label(), Condition::cases()))
        ->toBe(['Новое', 'Как новое', 'Отличное', 'Очень хорошее', 'Хорошее', 'Удовлетворительное', 'Плохое', 'На запчасти']);
});
