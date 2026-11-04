<?php

declare(strict_types=1);

use App\Domain\Listings\Enums\ListingEvent;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Exceptions\IllegalTransition;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use Tests\Support\ListingTransitions;

// Таблица SPEC §6.1: все пары (from, event) для обеих веток флага premoderation.
dataset('listing_transitions', fn (): array => ListingTransitions::cases());

it('статусы объявления — ровно 7 из SPEC §6.1', function () {
    expect(array_map(fn (ListingStatus $s): string => $s->value, ListingStatus::cases()))
        ->toBe(['draft', 'pending', 'published', 'needs_changes', 'rejected', 'withdrawn', 'expired']);
});

it('события машины — ровно 12 стрелок диаграммы SPEC §6.1', function () {
    expect(array_map(fn (ListingEvent $e): string => $e->value, ListingEvent::cases()))
        ->toBe([
            'publish', 'approve', 'return', 'reject', 'resubmit', 'substantial_edit',
            'minor_edit', 'price_drop', 'withdraw', 'expire', 'renew', 'relist',
        ]);
});

it('таблица покрывает все пары (from, event) для обеих веток флага', function () {
    expect(ListingTransitions::cases())->toHaveCount(168);
});

it('переход по таблице SPEC §6.1', function (ListingStatus $from, ListingEvent $event, bool $premoderation, ?ListingStatus $target) {
    if ($target === null) {
        expect(fn () => ListingStateMachine::target($from, $event, $premoderation))
            ->toThrow(IllegalTransition::class);
        expect(ListingStateMachine::allows($from, $event, $premoderation))->toBeFalse();

        return;
    }

    expect(ListingStateMachine::target($from, $event, $premoderation))->toBe($target)
        ->and(ListingStateMachine::allows($from, $event, $premoderation))->toBeTrue();
})->with('listing_transitions');

it('IllegalTransition называет исходный статус и событие', function () {
    try {
        ListingStateMachine::target(ListingStatus::Rejected, ListingEvent::Relist, true);
        $this->fail('Ожидался IllegalTransition');
    } catch (IllegalTransition $e) {
        expect($e->from)->toBe(ListingStatus::Rejected)
            ->and($e->event)->toBe(ListingEvent::Relist)
            ->and($e->getMessage())->toContain('rejected')->toContain('relist');
    }
});

it('rejected — конечный статус: из него нет переходов', function () {
    foreach (ListingEvent::cases() as $event) {
        expect(ListingStateMachine::allows(ListingStatus::Rejected, $event, true))->toBeFalse()
            ->and(ListingStateMachine::allows(ListingStatus::Rejected, $event, false))->toBeFalse();
    }
});
