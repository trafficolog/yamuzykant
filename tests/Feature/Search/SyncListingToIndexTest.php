<?php

declare(strict_types=1);

use App\Domain\Listings\Enums\ListingEvent;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\Events\ListingTransitioned;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use App\Domain\Search\Jobs\SyncListingToIndex;
use App\Domain\Search\ListingIndex;
use App\Support\Flags\FeatureFlag;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Cache;
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

    return array_values(array_map(
        fn (array $document): string => $document['id'],
        ListingIndex::default()->client()->index(ListingIndex::default()->name)->getDocuments()->getResults(),
    ));
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

/** @return array<int, class-string<ListingTransitioned>> */
function transitionEventClasses(): array
{
    return collect(glob(base_path('app/Domain/Listings/Events/Listing*.php')) ?: [])
        ->map(fn (string $file): string => 'App\\Domain\\Listings\\Events\\'.basename($file, '.php'))
        ->filter(fn (string $class): bool => is_subclass_of($class, ListingTransitioned::class))
        ->values()
        ->all();
}

it('каждое событие машины статусов ставит job синхронизации (без опоры на wildcard-подписку)', function () {
    $listing = ListingFixtures::published();
    $events = transitionEventClasses();
    expect($events)->toHaveCount(12);

    foreach ($events as $class) {
        Queue::fake();

        // from = to = published: переход касается индекса при любом событии.
        Event::dispatch(new $class($listing, ListingStatus::Published, ListingStatus::Published, ListingEvent::MinorEdit));

        Queue::assertPushed(
            SyncListingToIndex::class,
            fn (SyncListingToIndex $job): bool => $job->listingId === $listing->id,
        );
    }
});

it('одобрение модератором (ListingApproved) кладёт объявление в индекс', function () {
    Feature::for(null)->activate(FeatureFlag::Premoderation->value);
    $listing = ListingFixtures::draft();
    $machine = app(ListingStateMachine::class);
    $machine->publish($listing);
    expect(indexedIds())->toBe([]);

    $machine->approve($listing);

    expect(indexedIds())->toBe([$listing->id]);
});

it('повторная отправка после доработки (ListingResubmitted) кладёт объявление в индекс', function () {
    Feature::for(null)->activate(FeatureFlag::Premoderation->value);
    $listing = ListingFixtures::draft();
    $machine = app(ListingStateMachine::class);
    $machine->publish($listing);
    $machine->returnForChanges($listing, 'Добавьте фото серийного номера');
    expect(indexedIds())->toBe([]);

    Feature::for(null)->deactivate(FeatureFlag::Premoderation->value);
    $machine->resubmit($listing);

    expect($listing->fresh()?->status->value)->toBe('published')
        ->and(indexedIds())->toBe([$listing->id]);
});

it('возврат в продажу после снятия (ListingRelisted) снова кладёт объявление в индекс', function () {
    $listing = ListingFixtures::published();
    $machine = app(ListingStateMachine::class);
    $machine->withdraw($listing, WithdrawReason::ChangedMind);
    expect(indexedIds())->toBe([]);

    $machine->relist($listing);

    expect(indexedIds())->toBe([$listing->id]);
});

it('возврат на доработку (ListingReturned) и отклонение (ListingRejected) не пускают объявление в индекс', function () {
    Feature::for(null)->activate(FeatureFlag::Premoderation->value);
    $machine = app(ListingStateMachine::class);
    $returned = ListingFixtures::draft();
    $rejected = ListingFixtures::draft();
    $machine->publish($returned);
    $machine->publish($rejected);

    Queue::fake();
    $machine->returnForChanges($returned, 'Уточните состояние');
    $machine->reject($rejected, 'Запрещённый товар');

    Queue::assertNotPushed(SyncListingToIndex::class);
    expect(indexedIds())->toBe([]);
});

it('job синхронизации не выполняется параллельно для одного объявления (WithoutOverlapping по id)', function () {
    $middleware = (new SyncListingToIndex('listing-id'))->middleware();

    expect($middleware)->toHaveCount(1)
        ->and($middleware[0])->toBeInstanceOf(WithoutOverlapping::class)
        ->and($middleware[0]->key)->toBe('listing-id')
        ->and($middleware[0]->releaseAfter)->toBe(2)
        // Замок не вечный: упавший воркер не блокирует объявление навсегда.
        ->and($middleware[0]->expiresAfter)->toBeGreaterThan(0);
});

it('пока замок объявления занят, job не пишет в индекс; свободный замок — пишет', function () {
    $listing = ListingFixtures::published();
    Listing::query()->whereKey($listing->id)->toBase()->update(['status' => 'withdrawn']);
    $lock = Cache::lock('laravel-queue-overlap:'.SyncListingToIndex::class.':'.$listing->id, 30);
    expect($lock->get())->toBeTrue();

    SyncListingToIndex::dispatchSync($listing->id);
    expect(indexedIds())->toBe([$listing->id]);

    $lock->release();
    SyncListingToIndex::dispatchSync($listing->id);
    expect(indexedIds())->toBe([]);
});

it('замок одного объявления не мешает другому', function () {
    $busy = ListingFixtures::published();
    $other = ListingFixtures::published();
    Listing::query()->whereKey($other->id)->toBase()->update(['status' => 'withdrawn']);
    $lock = Cache::lock('laravel-queue-overlap:'.SyncListingToIndex::class.':'.$busy->id, 30);
    expect($lock->get())->toBeTrue();

    SyncListingToIndex::dispatchSync($other->id);

    expect(indexedIds())->toBe([$busy->id]);
    $lock->release();
});
