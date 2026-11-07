<?php

declare(strict_types=1);

use App\Domain\Listings\Models\Listing;
use App\Domain\Search\ListingIndex;
use Illuminate\Console\Scheduling\Event as ScheduledEvent;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Artisan;
use Tests\Support\ListingFixtures;
use Tests\Support\MeilisearchIndex;

// Ночная сверка БД и индекса (ARCHITECTURE §5): догоняет потерянные события — добавляет недостающее
// опубликованное и убирает лишнее.

beforeEach(function () {
    MeilisearchIndex::resetListings();
});

/** @return list<string> */
function reconcileIndexedIds(): array
{
    MeilisearchIndex::waitForTasks();
    $ids = array_map(
        fn (array $document): string => $document['id'],
        ListingIndex::default()->client()->index(ListingIndex::default()->name)->getDocuments()->getResults(),
    );
    sort($ids);

    return $ids;
}

it('добавляет опубликованное, которого нет в индексе, и убирает лишнее', function () {
    $kept = ListingFixtures::published();
    $lost = ListingFixtures::published();
    $withdrawn = ListingFixtures::published();

    // «Потерянные события»: $lost выпал из индекса, $withdrawn снят в БД, а из индекса не ушёл.
    $index = ListingIndex::default();
    $index->client()->index($index->name)->deleteDocument($lost->id);
    Listing::query()->whereKey($withdrawn->id)->toBase()->update(['status' => 'withdrawn']);
    // Документ строки, которой в БД уже нет.
    $ghost = ListingFixtures::published();
    Listing::query()->whereKey($ghost->id)->toBase()->delete();

    MeilisearchIndex::waitForTasks();

    $exit = Artisan::call('listings:reconcile-index');

    expect($exit)->toBe(0)
        ->and(reconcileIndexedIds())->toEqualCanonicalizing([$kept->id, $lost->id]);
});

it('сообщает, сколько добавлено и сколько убрано', function () {
    $lost = ListingFixtures::published();
    $withdrawn = ListingFixtures::published();
    $index = ListingIndex::default();
    $index->client()->index($index->name)->deleteDocument($lost->id);
    Listing::query()->whereKey($withdrawn->id)->toBase()->update(['status' => 'withdrawn']);
    MeilisearchIndex::waitForTasks();

    $exit = Artisan::call('listings:reconcile-index');

    expect($exit)->toBe(0)
        ->and(Artisan::output())->toContain('добавлено 1, убрано 1');
});

it('на согласованном индексе ничего не меняет', function () {
    ListingFixtures::published();
    ListingFixtures::published();
    MeilisearchIndex::waitForTasks();

    $exit = Artisan::call('listings:reconcile-index');

    expect($exit)->toBe(0)
        ->and(Artisan::output())->toContain('добавлено 0, убрано 0');
});

it('сверка выполняется по расписанию раз в сутки ночью, без наложения запусков', function () {
    /** @var Schedule $schedule */
    $schedule = app(Schedule::class);

    $event = collect($schedule->events())
        ->first(fn (ScheduledEvent $event): bool => str_contains((string) $event->command, 'listings:reconcile-index'));

    if (! $event instanceof ScheduledEvent) {
        throw new LogicException('Сверка индекса не стоит в расписании.');
    }
    [, $hour, $day, $month, $weekday] = explode(' ', $event->expression);
    expect([$day, $month, $weekday])->toBe(['*', '*', '*'])
        ->and((int) $hour)->toBeGreaterThanOrEqual(1)->toBeLessThanOrEqual(5)
        ->and($event->withoutOverlapping)->toBeTrue()
        ->and($event->onOneServer)->toBeTrue();
});
