<?php

declare(strict_types=1);

use App\Domain\Listings\Actions\ExpireListings;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Events\ListingExpired;
use App\Domain\Listings\Models\Listing;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    config(['scout.driver' => 'null']);
    Carbon::setTestNow('2026-11-03 12:00:00');
});

it('срок публикации — 60 дней из конфига (уточнить)', function () {
    expect(config('listings.expire_after_days'))->toBe(60);
});

it('снимает опубликованные дольше срока, остальные не трогает', function () {
    Event::fake([ListingExpired::class]);
    $old = Listing::factory()->inStatus(ListingStatus::Published)->create(['published_at' => now()->subDays(60)]);
    $fresh = Listing::factory()->inStatus(ListingStatus::Published)->create(['published_at' => now()->subDays(59)]);
    $pending = Listing::factory()->inStatus(ListingStatus::Pending)->create(['published_at' => null]);

    $count = app(ExpireListings::class)();

    expect($count)->toBe(1)
        ->and($old->fresh()?->status)->toBe(ListingStatus::Expired)
        ->and($fresh->fresh()?->status)->toBe(ListingStatus::Published)
        ->and($pending->fresh()?->status)->toBe(ListingStatus::Pending);
    Event::assertDispatchedTimes(ListingExpired::class, 1);
});

it('срок берётся из конфига', function () {
    config(['listings.expire_after_days' => 30]);
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['published_at' => now()->subDays(31)]);

    app(ExpireListings::class)();

    expect($listing->fresh()?->status)->toBe(ListingStatus::Expired);
});

it('дата окончания показа — published_at + срок', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['published_at' => '2026-11-01 08:00:00']);

    expect($listing->expiresAt()?->toDateTimeString())->toBe('2026-12-31 08:00:00')
        ->and(Listing::factory()->make(['published_at' => null])->expiresAt())->toBeNull();
});

it('снятие по сроку запланировано ежечасно', function () {
    $events = collect(app(Schedule::class)->events())
        ->filter(fn ($event): bool => str_contains((string) $event->command, 'listings:expire'));

    expect($events)->toHaveCount(1)
        ->and($events->first()?->expression)->toBe('0 * * * *')
        ->and($events->first()?->withoutOverlapping)->toBeTrue();
});

it('команду listings:expire можно запустить вручную', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['published_at' => now()->subDays(61)]);

    $this->artisan('listings:expire')
        ->expectsOutputToContain('1')
        ->assertExitCode(0);

    expect($listing->fresh()?->status)->toBe(ListingStatus::Expired);
});
