<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use Illuminate\Support\Facades\DB;

// 2.1.7: защита владельца и смены статуса в глубину.

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('forceFill user_id у существующего объявления — исключение', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Draft)->create();
    $owner = $listing->user_id;
    $other = User::factory()->create();

    expect(fn () => $listing->forceFill(['user_id' => $other->id])->save())->toThrow(LogicException::class);
    expect((int) DB::table('listings')->where('id', $listing->id)->value('user_id'))->toBe($owner);
});

it('update user_id у существующего объявления — исключение', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Draft)->create();
    $owner = $listing->user_id;
    $other = User::factory()->create();

    expect(fn () => $listing->update(['user_id' => $other->id]))->toThrow(LogicException::class);
    expect((int) DB::table('listings')->where('id', $listing->id)->value('user_id'))->toBe($owner);
});

it('user_id задаётся при создании и не мешает обычной правке', function () {
    $user = User::factory()->create();
    $listing = Listing::factory()->inStatus(ListingStatus::Draft)->create(['user_id' => $user->id]);

    $listing->title = 'Fender ’62 Stratocaster';
    $listing->save();

    expect($listing->fresh()?->user_id)->toBe($user->id);
});

it('исключение внутри withStatusChange не оставляет разрешение включённым', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Draft)->create();

    try {
        $listing->withStatusChange(fn () => throw new RuntimeException('сбой'));
    } catch (RuntimeException) {
    }

    $listing->status = ListingStatus::Published;

    expect(fn () => $listing->save())->toThrow(LogicException::class);
});

it('разрешение смены статуса действует только на свой экземпляр', function () {
    $a = Listing::factory()->inStatus(ListingStatus::Draft)->create();
    $b = Listing::factory()->inStatus(ListingStatus::Draft)->create();

    $a->withStatusChange(function () use ($b): void {
        $b->status = ListingStatus::Published;

        expect(fn () => $b->save())->toThrow(LogicException::class);
    });
});

it('исключение внутри перехода машины не оставляет разрешение смены статуса включённым', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Draft)->create();
    $other = Listing::factory()->inStatus(ListingStatus::Draft)->create();

    Listing::saved(function (): void {
        throw new RuntimeException('сбой после записи');
    });

    try {
        expect(fn () => app(ListingStateMachine::class)->publish($listing))->toThrow(RuntimeException::class);
    } finally {
        Listing::clearBootedModels();
    }

    $other->status = ListingStatus::Published;
    expect(fn () => $other->save())->toThrow(LogicException::class);

    $listing->refresh();
    $listing->status = ListingStatus::Published;
    expect(fn () => $listing->save())->toThrow(LogicException::class);
});
