<?php

declare(strict_types=1);

use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Search\ListingIndex;
use Tests\Support\ListingFixtures;
use Tests\Support\MeilisearchIndex;

// Критерии 3.1.1: «В индексе нет серийного номера, e-mail, user_id»; индекс listings — только published,
// документ из явных полей (ARCHITECTURE §5); настройки фильтров и сортировок.

beforeEach(function () {
    MeilisearchIndex::resetListings();
});

/** @return array<string, mixed> */
function indexedDocument(Listing $listing): array
{
    MeilisearchIndex::waitForTasks();

    return ListingIndex::default()->client()->index(ListingIndex::default()->name)->getDocument($listing->id);
}

it('индекс называется listings, с префиксом окружения', function () {
    expect(ListingIndex::default()->name)->toBe(config('scout.prefix').'listings');
});

it('опубликованное объявление попадает в индекс документом из явных полей', function () {
    $city = ListingFixtures::city('Москва', 55.7558, 37.6173);
    $listing = ListingFixtures::published(['ship' => true], $city);

    $document = indexedDocument($listing);

    expect($document)->toMatchArray([
        'id' => $listing->id,
        'title' => 'Fender ’57 Stratocaster',
        'model' => 'American Vintage ’57 Stratocaster',
        'brand' => 'Fender',
        'description' => 'Родной кейс, оригинальные звукосниматели.',
        'category_path' => ['gitary', 'gitary/elektrogitary'],
        'condition' => 'excellent',
        'price' => 184_500,
        'city_id' => $city->id,
        'ship' => true,
        'negotiable' => true,
    ]);
    expect($document['published_at'])->toBe($listing->fresh()?->published_at?->getTimestamp());
});

it('набор полей документа фиксирован: ничего лишнего', function () {
    $listing = ListingFixtures::published();

    $keys = array_keys(indexedDocument($listing));
    sort($keys);

    expect($keys)->toBe([
        'aliases', 'brand', 'category_path', 'city_id', 'condition', 'description', 'id',
        'model', 'negotiable', 'price', 'published_at', 'ship', 'title',
    ]);
});

it('в индексе нет серийного номера, e-mail, user_id и итоговой цены', function () {
    $listing = ListingFixtures::published(['serial_enc' => 'ZX99-SECRET-4321']);
    $owner = $listing->user;

    $document = indexedDocument($listing);
    $json = json_encode($document, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);

    foreach (['serial', 'serial_enc', 'serial_masked', 'email', 'user_id', 'user', 'final_price'] as $forbidden) {
        expect($document)->not->toHaveKey($forbidden);
    }
    expect($json)->not->toContain('ZX99')
        ->and($json)->not->toContain('SECRET')
        ->and($json)->not->toContain($owner->email)
        ->and($json)->not->toContain('"user_id"');
});

it('координат в документе нет: «рядом» в MVP не бывает (решение OWNER 07.11.2026)', function () {
    $listing = ListingFixtures::published(city: ListingFixtures::city('Москва', 55.7558, 37.6173));

    expect($listing->toSearchableArray())->not->toHaveKey('_geo')
        ->and(indexedDocument($listing))->not->toHaveKey('_geo');
});

it('в индексе только published: прочие статусы не индексируются', function (ListingStatus $status, bool $indexed) {
    $listing = ListingFixtures::draft();
    // Данные «из БД» в нужном статусе, в обход машины — как сделал бы импорт.
    Listing::query()->whereKey($listing->id)->toBase()->update(['status' => $status->value, 'published_at' => now()]);
    $listing->refresh();

    expect($listing->shouldBeSearchable())->toBe($indexed);

    Listing::makeAllSearchable();
    MeilisearchIndex::waitForTasks();

    $found = ListingIndex::default()->client()->index(ListingIndex::default()->name)->getDocuments()->getResults();
    expect(count($found))->toBe($indexed ? 1 : 0);
})->with([
    'draft' => [ListingStatus::Draft, false],
    'pending' => [ListingStatus::Pending, false],
    'published' => [ListingStatus::Published, true],
    'needs_changes' => [ListingStatus::NeedsChanges, false],
    'rejected' => [ListingStatus::Rejected, false],
    'withdrawn' => [ListingStatus::Withdrawn, false],
    'expired' => [ListingStatus::Expired, false],
]);

it('настройки индекса: фильтры, сортировки, поля поиска, стоп-слова, ранжирование', function () {
    $settings = ListingIndex::default()->client()->index(ListingIndex::default()->name)->getSettings();

    expect($settings['searchableAttributes'])->toBe(['title', 'model', 'brand', 'aliases', 'description'])
        ->and($settings['filterableAttributes'])->toEqualCanonicalizing([
            'category_path', 'condition', 'price', 'city_id', 'ship', 'negotiable',
        ])
        ->and($settings['sortableAttributes'])->toEqualCanonicalizing(['published_at', 'price'])
        ->and($settings['rankingRules'])->toBe(['words', 'sort', 'typo', 'proximity', 'attribute', 'exactness'])
        ->and($settings['stopWords'])->toContain('для', 'на')
        ->and($settings['typoTolerance']['enabled'])->toBeTrue();
});
