<?php

declare(strict_types=1);

use App\Domain\Listings\Enums\ListingEvent;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\Events\ListingApproved;
use App\Domain\Listings\Events\ListingExpired;
use App\Domain\Listings\Events\ListingMinorEdited;
use App\Domain\Listings\Events\ListingPriceDropped;
use App\Domain\Listings\Events\ListingPublished;
use App\Domain\Listings\Events\ListingRejected;
use App\Domain\Listings\Events\ListingRelisted;
use App\Domain\Listings\Events\ListingRenewed;
use App\Domain\Listings\Events\ListingResubmitted;
use App\Domain\Listings\Events\ListingReturned;
use App\Domain\Listings\Events\ListingSubstantiallyEdited;
use App\Domain\Listings\Events\ListingTransitioned;
use App\Domain\Listings\Events\ListingWithdrawn;
use App\Domain\Listings\Exceptions\IllegalTransition;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\SaleRecord;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use App\Domain\Moderation\Enums\ModerationVerdict;
use App\Domain\Moderation\Models\ModerationDecision;
use App\Support\Flags\FeatureFlag;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Laravel\Pennant\Feature;
use Tests\Support\ListingTransitions;

// Таблица SPEC §6.1: все пары (from, event) для обеих веток флага premoderation.
dataset('listing_transitions', fn (): array => ListingTransitions::cases());

beforeEach(function () {
    // Модели справочника индексируются в Meilisearch; машине статусов индекс не нужен.
    config(['scout.driver' => 'null']);
});

function setPremoderation(bool $on): void
{
    $on
        ? Feature::for(null)->activate(FeatureFlag::Premoderation->value)
        : Feature::for(null)->deactivate(FeatureFlag::Premoderation->value);
}

/**
 * Вызов метода машины, который порождает событие, с типовыми аргументами.
 *
 * @return Closure(ListingStateMachine, Listing): Listing
 */
function fireListingEvent(ListingEvent $event): Closure
{
    return match ($event) {
        ListingEvent::Publish => fn (ListingStateMachine $m, Listing $l) => $m->publish($l),
        ListingEvent::Approve => fn (ListingStateMachine $m, Listing $l) => $m->approve($l, staffId: 7),
        ListingEvent::Return => fn (ListingStateMachine $m, Listing $l) => $m->returnForChanges($l, 'Добавьте фото серийного номера', staffId: 7),
        ListingEvent::Reject => fn (ListingStateMachine $m, Listing $l) => $m->reject($l, 'Запрещённый товар', staffId: 7),
        ListingEvent::Resubmit => fn (ListingStateMachine $m, Listing $l) => $m->resubmit($l),
        ListingEvent::SubstantialEdit => fn (ListingStateMachine $m, Listing $l) => $m->edit($l, ['description' => 'Новое описание']),
        ListingEvent::MinorEdit => fn (ListingStateMachine $m, Listing $l) => $m->edit($l, ['ship' => ! $l->ship]),
        ListingEvent::PriceDrop => fn (ListingStateMachine $m, Listing $l) => $m->edit($l, ['price' => (int) $l->price - 1000]),
        ListingEvent::Withdraw => fn (ListingStateMachine $m, Listing $l) => $m->withdraw($l, WithdrawReason::SoldHere, 180_000),
        ListingEvent::Expire => fn (ListingStateMachine $m, Listing $l) => $m->expire($l),
        ListingEvent::Renew => fn (ListingStateMachine $m, Listing $l) => $m->renew($l),
        ListingEvent::Relist => fn (ListingStateMachine $m, Listing $l) => $m->relist($l),
    };
}

/** @return class-string<ListingTransitioned> */
function listingEventClass(ListingEvent $event): string
{
    return match ($event) {
        ListingEvent::Publish => ListingPublished::class,
        ListingEvent::Approve => ListingApproved::class,
        ListingEvent::Return => ListingReturned::class,
        ListingEvent::Reject => ListingRejected::class,
        ListingEvent::Resubmit => ListingResubmitted::class,
        ListingEvent::SubstantialEdit => ListingSubstantiallyEdited::class,
        ListingEvent::MinorEdit => ListingMinorEdited::class,
        ListingEvent::PriceDrop => ListingPriceDropped::class,
        ListingEvent::Withdraw => ListingWithdrawn::class,
        ListingEvent::Expire => ListingExpired::class,
        ListingEvent::Renew => ListingRenewed::class,
        ListingEvent::Relist => ListingRelisted::class,
    };
}

it('каждая пара (from, event) через машину: допустимая сохраняет статус и шлёт своё событие, недопустимая — IllegalTransition без изменений', function (ListingStatus $from, ListingEvent $event, bool $premoderation, ?ListingStatus $target) {
    setPremoderation($premoderation);
    Event::fake();
    $listing = Listing::factory()->inStatus($from)->create();
    $machine = app(ListingStateMachine::class);

    if ($target === null) {
        expect(fn () => fireListingEvent($event)($machine, $listing))->toThrow(IllegalTransition::class);
        expect($listing->fresh()?->status)->toBe($from);
        Event::assertNotDispatched(ListingTransitioned::class);

        return;
    }

    $result = fireListingEvent($event)($machine, $listing);

    expect($result->status)->toBe($target)
        ->and($listing->status)->toBe($target)
        ->and($listing->fresh()?->status)->toBe($target);

    Event::assertDispatched(listingEventClass($event), fn (ListingTransitioned $e): bool => $e->listing->is($listing)
        && $e->from === $from
        && $e->to === $target
        && $e->event === $event);
})->with('listing_transitions');

it('машина берёт статус из БД под блокировкой: устаревший экземпляр не обходит правила', function () {
    setPremoderation(false);
    $listing = Listing::factory()->inStatus(ListingStatus::Draft)->create();
    $stale = Listing::query()->findOrFail($listing->id);

    app(ListingStateMachine::class)->publish($listing);

    // Второй экземпляр всё ещё думает, что объявление — черновик; повторная публикация недопустима.
    expect(fn () => app(ListingStateMachine::class)->publish($stale))->toThrow(IllegalTransition::class)
        ->and($stale->status)->toBe(ListingStatus::Published);
});

it('публикация ставит published_at, повторный вход в published его обновляет, правка — нет', function () {
    setPremoderation(false);
    Carbon::setTestNow('2026-11-03 10:00:00');
    $listing = Listing::factory()->inStatus(ListingStatus::Draft)->create(['published_at' => null]);
    $machine = app(ListingStateMachine::class);

    $machine->publish($listing);
    expect($listing->fresh()?->published_at?->toDateTimeString())->toBe('2026-11-03 10:00:00');

    Carbon::setTestNow('2026-11-04 10:00:00');
    $machine->edit($listing, ['price' => 150_000]);
    expect($listing->fresh()?->published_at?->toDateTimeString())->toBe('2026-11-03 10:00:00');

    $machine->withdraw($listing, WithdrawReason::ChangedMind);
    Carbon::setTestNow('2026-11-05 10:00:00');
    $machine->relist($listing);
    expect($listing->fresh()?->published_at?->toDateTimeString())->toBe('2026-11-05 10:00:00');
});

it('уход в pending снимает дату публикации, одобрение ставит новую', function () {
    setPremoderation(true);
    Carbon::setTestNow('2026-11-03 10:00:00');
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['published_at' => '2026-10-01 00:00:00']);
    $machine = app(ListingStateMachine::class);

    $machine->edit($listing, ['condition' => 'good']);
    expect($listing->fresh()?->published_at)->toBeNull();

    $machine->approve($listing);
    expect($listing->fresh()?->published_at?->toDateTimeString())->toBe('2026-11-03 10:00:00');
});

it('решения модерации пишутся в moderation_decisions с причиной и автором', function () {
    setPremoderation(true);
    $machine = app(ListingStateMachine::class);

    $returned = Listing::factory()->inStatus(ListingStatus::Pending)->create();
    $machine->returnForChanges($returned, 'Добавьте фото серийного номера', staffId: 11);

    $rejected = Listing::factory()->inStatus(ListingStatus::Pending)->create();
    $machine->reject($rejected, 'Запрещённый товар', staffId: 12);

    $approved = Listing::factory()->inStatus(ListingStatus::Pending)->create();
    $machine->approve($approved, staffId: 13);

    expect(ModerationDecision::query()->where('listing_id', $returned->id)->sole())
        ->verdict->toBe(ModerationVerdict::Returned)
        ->reason->toBe('Добавьте фото серийного номера')
        ->staff_id->toBe(11)
        ->and(ModerationDecision::query()->where('listing_id', $rejected->id)->sole())
        ->verdict->toBe(ModerationVerdict::Rejected)
        ->reason->toBe('Запрещённый товар')
        ->staff_id->toBe(12)
        ->and(ModerationDecision::query()->where('listing_id', $approved->id)->sole())
        ->verdict->toBe(ModerationVerdict::Approved)
        ->reason->toBeNull()
        ->staff_id->toBe(13)
        ->and($approved->moderationDecisions()->count())->toBe(1);
});

it('вернуть и отклонить без причины нельзя', function (string $method) {
    $listing = Listing::factory()->inStatus(ListingStatus::Pending)->create();

    expect(fn () => app(ListingStateMachine::class)->{$method}($listing, '   '))
        ->toThrow(InvalidArgumentException::class);
    expect($listing->fresh()?->status)->toBe(ListingStatus::Pending)
        ->and(ModerationDecision::query()->count())->toBe(0);
})->with(['returnForChanges', 'reject']);

it('снятие «продал» пишет sale_records с итоговой ценой и датой', function (WithdrawReason $reason) {
    Carbon::setTestNow('2026-11-03 21:30:00');
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create();

    app(ListingStateMachine::class)->withdraw($listing, $reason, 170_000);

    expect($listing->saleRecord)->not->toBeNull()
        ->and($listing->saleRecord?->reason)->toBe($reason)
        ->and($listing->saleRecord?->final_price)->toBe(170_000)
        ->and($listing->saleRecord?->sold_at?->toDateString())->toBe('2026-11-03');
})->with(fn (): array => [WithdrawReason::SoldHere, WithdrawReason::SoldElsewhere]);

it('итоговая цена необязательна', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create();

    app(ListingStateMachine::class)->withdraw($listing, WithdrawReason::SoldElsewhere);

    expect($listing->saleRecord?->final_price)->toBeNull()
        ->and($listing->saleRecord?->sold_at)->not->toBeNull();
});

it('«передумал» и модерация: причина записана, итоговой цены и даты продажи нет', function (WithdrawReason $reason) {
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create();

    app(ListingStateMachine::class)->withdraw($listing, $reason);

    expect($listing->saleRecord?->reason)->toBe($reason)
        ->and($listing->saleRecord?->final_price)->toBeNull()
        ->and($listing->saleRecord?->sold_at)->toBeNull();
})->with(fn (): array => [WithdrawReason::ChangedMind, WithdrawReason::Moderation]);

it('итоговая цена без продажи или не больше нуля — ошибка, статус не меняется', function (WithdrawReason $reason, int $price) {
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create();

    expect(fn () => app(ListingStateMachine::class)->withdraw($listing, $reason, $price))
        ->toThrow(InvalidArgumentException::class);
    expect($listing->fresh()?->status)->toBe(ListingStatus::Published)
        ->and(SaleRecord::query()->count())->toBe(0);
})->with(fn (): array => [
    'передумал с ценой' => [WithdrawReason::ChangedMind, 100_000],
    'ноль' => [WithdrawReason::SoldHere, 0],
    'отрицательная' => [WithdrawReason::SoldHere, -5],
]);

it('повторное снятие после возврата в продажу заменяет запись о продаже', function () {
    setPremoderation(false);
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create();
    $machine = app(ListingStateMachine::class);

    $machine->withdraw($listing, WithdrawReason::SoldHere, 170_000);
    $machine->relist($listing);
    expect(SaleRecord::query()->where('listing_id', $listing->id)->exists())->toBeFalse();

    $machine->withdraw($listing, WithdrawReason::SoldElsewhere, 160_000);

    expect(SaleRecord::query()->where('listing_id', $listing->id)->sole())
        ->reason->toBe(WithdrawReason::SoldElsewhere)
        ->final_price->toBe(160_000);
});

it('события перехода отправляются после фиксации транзакции', function () {
    expect(new ListingPublished(Listing::factory()->make(), ListingStatus::Draft, ListingStatus::Published, ListingEvent::Publish))
        ->toBeInstanceOf(Illuminate\Contracts\Events\ShouldDispatchAfterCommit::class);
});
