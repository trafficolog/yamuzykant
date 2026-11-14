<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\Exceptions\IllegalTransition;
use App\Domain\Listings\Exceptions\ListingLimitReached;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Rules\ActiveListingLimit;
use App\Domain\Listings\StateMachines\ListingStateMachine;

// BR-06: лимит активных объявлений частного лица — 10, значение в config listings.active_limit.
// Активные — published, pending, needs_changes (карточка 2.1.6).

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('максимум берётся из конфига, по умолчанию 10', function () {
    expect(ActiveListingLimit::max())->toBe(10);

    config(['listings.active_limit' => 4]);
    expect(ActiveListingLimit::max())->toBe(4);
});

it('считает только published, pending и needs_changes этого пользователя', function () {
    $user = User::factory()->create();
    foreach (ListingStatus::cases() as $status) {
        if ($status !== ListingStatus::Draft) {
            Listing::factory()->for($user)->inStatus($status)->create();
        }
    }
    Listing::factory()->for($user)->create();
    Listing::factory()->for(User::factory()->create())->inStatus(ListingStatus::Published)->create();

    expect(ActiveListingLimit::activeCount($user))->toBe(3);
});

it('assertAvailable пропускает, пока есть место, и бросает при достижении лимита', function () {
    config(['listings.active_limit' => 2]);
    $user = User::factory()->create();
    Listing::factory()->for($user)->inStatus(ListingStatus::Published)->create();

    ActiveListingLimit::assertAvailable($user);
    Listing::factory()->for($user)->inStatus(ListingStatus::Pending)->create();

    expect(fn () => ActiveListingLimit::assertAvailable($user))->toThrow(ListingLimitReached::class);
});

it('текст отказа склоняется: 1 активное объявление, 2 активных объявления, 10 активных объявлений', function (int $limit, string $phrase) {
    config(['listings.active_limit' => $limit]);
    $user = User::factory()->create();
    Listing::factory()->count($limit)->for($user)->inStatus(ListingStatus::Published)->create();

    try {
        ActiveListingLimit::assertAvailable($user);
        $this->fail('Лимит не сработал.');
    } catch (ListingLimitReached $e) {
        expect($e->getMessage())->toBe("Достигнут лимит: {$phrase}. Снимите одно с продажи, чтобы опубликовать новое.");
    }
})->with([
    [1, '1 активное объявление'],
    [2, '2 активных объявления'],
    [10, '10 активных объявлений'],
    [21, '21 активное объявление'],
]);

// Лимит применяется и к возврату в активные: renew (expired) и relist (withdrawn). resubmit лимит не меняет.
describe('возврат в активные (renew, relist)', function () {
    it('renew и relist при полном лимите отказывают, статус не меняется', function (ListingStatus $from, string $method) {
        config(['listings.active_limit' => 1]);
        $user = User::factory()->create();
        Listing::factory()->for($user)->inStatus(ListingStatus::Published)->create();
        $listing = Listing::factory()->for($user)->inStatus($from)->create();

        expect(fn () => app(ListingStateMachine::class)->{$method}($listing))->toThrow(ListingLimitReached::class);
        expect($listing->refresh()->status)->toBe($from);
    })->with([
        'renew' => [ListingStatus::Expired, 'renew'],
        'relist' => [ListingStatus::Withdrawn, 'relist'],
    ]);

    it('renew и relist пропускают, пока есть место, и сами занимают его', function (ListingStatus $from, string $method) {
        config(['listings.active_limit' => 2]);
        $user = User::factory()->create();
        Listing::factory()->for($user)->inStatus(ListingStatus::Published)->create();
        $listing = Listing::factory()->for($user)->inStatus($from)->create();

        app(ListingStateMachine::class)->{$method}($listing);

        expect($listing->refresh()->status)->toBe(ListingStatus::Published)
            ->and(ActiveListingLimit::activeCount($user))->toBe(2);
    })->with([
        'renew' => [ListingStatus::Expired, 'renew'],
        'relist' => [ListingStatus::Withdrawn, 'relist'],
    ]);

    it('снятое объявление освобождает место для возврата другого', function () {
        config(['listings.active_limit' => 1]);
        $user = User::factory()->create();
        $active = Listing::factory()->for($user)->inStatus(ListingStatus::Published)->create();
        $expired = Listing::factory()->for($user)->inStatus(ListingStatus::Expired)->create();
        $machine = app(ListingStateMachine::class);

        $machine->withdraw($active, WithdrawReason::SoldElsewhere);
        $machine->renew($expired);

        expect($expired->refresh()->status)->toBe(ListingStatus::Published);
    });

    it('resubmit из needs_changes лимит не проверяет: объявление уже активное', function () {
        config(['listings.active_limit' => 1]);
        $user = User::factory()->create();
        $listing = Listing::factory()->for($user)->inStatus(ListingStatus::NeedsChanges)->create();

        app(ListingStateMachine::class)->resubmit($listing);

        expect($listing->refresh()->status)->toBe(ListingStatus::Published);
    });

    it('недопустимый переход важнее лимита', function () {
        config(['listings.active_limit' => 1]);
        $user = User::factory()->create();
        Listing::factory()->for($user)->inStatus(ListingStatus::Published)->create();
        $listing = Listing::factory()->for($user)->inStatus(ListingStatus::Published)->create();

        expect(fn () => app(ListingStateMachine::class)->renew($listing))->toThrow(IllegalTransition::class);
    });
});
