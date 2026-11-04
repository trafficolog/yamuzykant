<?php

declare(strict_types=1);

use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\Events\ListingTransitioned;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use App\Domain\Search\Jobs\SyncListingToIndex;
use App\Domain\Search\ListingIndex;
use App\Support\Flags\FeatureFlag;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Laravel\Pennant\Feature;
use Tests\Support\ListingFixtures;
use Tests\Support\MeilisearchIndex;

// Критерий 3.1.1: «Снятое объявление исчезает из выдачи ≤ 60 с». Событие машины статусов → job в очереди,
// без задержки; job смотрит на состояние БД, а не на событие, поэтому порядок доставки не важен.

beforeEach(function () {
    MeilisearchIndex::resetListings();
});

/** @return list<string> */
function indexedIds(): array
{
    MeilisearchIndex::waitForTasks();

    return array_map(
        fn (array $document): string => $document['id'],
        ListingIndex::default()->client()->index(ListingIndex::default()->name)->getDocuments()->getResults(),
    );
}

it('публикация кладёт объявление в индекс', function () {
    $listing = ListingFixtures::published();

    expect(indexedIds())->toBe([$listing->id]);
});

it('снятие с продажи убирает объявление из индекса', function () {
    $listing = ListingFixtures::published();
    expect(indexedIds())->toBe([$listing->id]);

    app(ListingStateMachine::class)->withdraw($listing, WithdrawReason::ChangedMind);

    expect(indexedIds())->toBe([]);
});

it('истечение срока убирает объявление из индекса', function () {
    $listing = ListingFixtures::published();

    app(ListingStateMachine::class)->expire($listing);

    expect(indexedIds())->toBe([]);
});

it('существенная правка при включённой премодерации уводит объявление из индекса', function () {
    $listing = ListingFixtures::published();
    Feature::for(null)->activate(FeatureFlag::Premoderation->value);

    app(ListingStateMachine::class)->edit($listing, ['title' => 'Fender Telecaster']);

    expect($listing->fresh()?->status->value)->toBe('pending')
        ->and(indexedIds())->toBe([]);
});

it('возврат в продажу из expired снова кладёт объявление в индекс', function () {
    $listing = ListingFixtures::published();
    $machine = app(ListingStateMachine::class);
    $machine->expire($listing);
    expect(indexedIds())->toBe([]);

    $machine->renew($listing);

    expect(indexedIds())->toBe([$listing->id]);
});

it('несущественная правка обновляет документ', function () {
    $listing = ListingFixtures::published();

    app(ListingStateMachine::class)->edit($listing, ['negotiable' => false, 'ship' => true]);
    MeilisearchIndex::waitForTasks();

    $document = ListingIndex::default()->client()->index(ListingIndex::default()->name)->getDocument($listing->id);
    expect($document['negotiable'])->toBeFalse()
        ->and($document['ship'])->toBeTrue();
});

it('снижение цены обновляет цену в документе', function () {
    $listing = ListingFixtures::published(['price' => 184_500]);

    app(ListingStateMachine::class)->edit($listing, ['price' => 170_000]);
    MeilisearchIndex::waitForTasks();

    $document = ListingIndex::default()->client()->index(ListingIndex::default()->name)->getDocument($listing->id);
    expect($document['price'])->toBe(170_000);
});

it('событие ставит job в очередь без задержки, а не индексирует в запросе', function () {
    Queue::fake();
    $listing = ListingFixtures::draft();

    app(ListingStateMachine::class)->publish($listing);

    Queue::assertPushed(
        SyncListingToIndex::class,
        fn (SyncListingToIndex $job): bool => $job->listingId === $listing->id && $job->delay === null,
    );
    expect(indexedIds())->toBe([]);
});

it('job для опубликованного после снятия сам убирает документ: порядок доставки не важен', function () {
    $listing = ListingFixtures::published();
    // Снятие уже произошло в БД, а job «публикации» приходит позже.
    Listing::query()->whereKey($listing->id)->toBase()->update(['status' => 'withdrawn']);

    (new SyncListingToIndex($listing->id))->handle();

    expect(indexedIds())->toBe([]);
});

it('job для удалённой из БД строки убирает документ и не падает', function () {
    $listing = ListingFixtures::published();
    Listing::query()->whereKey($listing->id)->toBase()->delete();

    (new SyncListingToIndex($listing->id))->handle();

    expect(indexedIds())->toBe([]);
});

it('job повторяем без вреда', function () {
    $listing = ListingFixtures::published();

    (new SyncListingToIndex($listing->id))->handle();
    (new SyncListingToIndex($listing->id))->handle();

    expect(indexedIds())->toBe([$listing->id]);
});

it('переходы вне published (draft → pending) индекс не трогают', function () {
    Feature::for(null)->activate(FeatureFlag::Premoderation->value);
    $listing = ListingFixtures::draft();
    Queue::fake();

    app(ListingStateMachine::class)->publish($listing);

    expect($listing->fresh()?->status->value)->toBe('pending');
    Queue::assertNotPushed(SyncListingToIndex::class);
});

it('удаление строки объявления убирает документ из индекса', function () {
    $listing = ListingFixtures::published();
    expect(indexedIds())->toBe([$listing->id]);

    $listing->delete();

    expect(indexedIds())->toBe([]);
});

it('все события машины статусов подписаны на синхронизацию индекса', function () {
    $events = collect(glob(base_path('app/Domain/Listings/Events/Listing*.php')) ?: [])
        ->map(fn (string $file): string => 'App\\Domain\\Listings\\Events\\'.basename($file, '.php'))
        ->filter(fn (string $class): bool => is_subclass_of($class, ListingTransitioned::class));

    expect($events)->not->toBeEmpty();
    foreach ($events as $event) {
        expect(Event::hasListeners($event))->toBeTrue("нет слушателя у {$event}");
    }
});
