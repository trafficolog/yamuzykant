<?php

declare(strict_types=1);

use App\Domain\Catalog\Models\City;
use App\Domain\Listings\Enums\Condition;
use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use App\Domain\Search\ListingSearch;
use App\Domain\Search\ListingSort;
use Tests\Support\ListingFixtures;
use Tests\Support\MeilisearchIndex;

// UC-S2, UC-S3: поиск запросом и по категории, фильтры, сортировки. BR-01: город применяется ко всей выдаче
// и обязателен. Meilisearch — настоящий.

beforeEach(function () {
    MeilisearchIndex::resetListings();
});

/** Города теста; создаются при первом обращении, база с нуля для каждого теста. */
function moscow(): City
{
    return City::query()->where('name', 'Москва')->first() ?? ListingFixtures::city('Москва', 55.7558, 37.6173);
}

function kazan(): City
{
    return City::query()->where('name', 'Казань')->first() ?? ListingFixtures::city('Казань', 55.7887, 49.1221);
}

function searchIn(City $city): ListingSearch
{
    MeilisearchIndex::waitForTasks();

    return ListingSearch::inCity($city);
}

it('город обязателен: поиск создаётся только для города', function () {
    $method = new ReflectionMethod(ListingSearch::class, 'inCity');
    $parameter = $method->getParameters()[0];

    expect($parameter->getType()?->allowsNull())->toBeFalse()
        ->and((new ReflectionClass(ListingSearch::class))->getConstructor()?->isPrivate())->toBeTrue();
});

it('выдача ограничена городом (BR-01)', function () {
    $inMoscow = ListingFixtures::published(city: moscow());
    ListingFixtures::published(city: kazan());

    $result = searchIn(moscow())->get();

    expect($result->ids)->toBe([$inMoscow->id])
        ->and($result->total)->toBe(1);
});

it('снятое объявление пропадает из выдачи', function () {
    $listing = ListingFixtures::published(city: moscow());
    expect(searchIn(moscow())->get()->total)->toBe(1);

    app(ListingStateMachine::class)->withdraw($listing, WithdrawReason::SoldElsewhere);

    expect(searchIn(moscow())->get()->total)->toBe(0);
});

it('находит по названию, модели, бренду и описанию', function (string $query) {
    $listing = ListingFixtures::published([
        'title' => 'Гитара в отличном состоянии',
        'description' => 'Родной чехол, свежие струны Ernie Ball.',
    ], moscow());

    expect(searchIn(moscow())->matching($query)->get()->ids)->toBe([$listing->id]);
})->with([
    'по названию' => 'отличном',
    'по модели' => 'American Vintage',
    'по бренду' => 'Fender',
    'по описанию' => 'Ernie',
]);

it('опечатка в одну букву не мешает найти', function () {
    $listing = ListingFixtures::published(city: moscow());

    expect(searchIn(moscow())->matching('Stratocastr')->get()->ids)->toBe([$listing->id])
        ->and(searchIn(moscow())->matching('Fendr')->get()->ids)->toBe([$listing->id]);
});

it('русское написание «стратокастер» находит Stratocaster (синонимы 1.2.2)', function () {
    $listing = ListingFixtures::published(['title' => 'Электрогитара'], moscow());

    expect(searchIn(moscow())->matching('стратокастер')->get()->ids)->toBe([$listing->id]);
});

it('запрос, которого нет в объявлениях, возвращает пустую выдачу', function () {
    ListingFixtures::published(city: moscow());

    $result = searchIn(moscow())->matching('саксофон')->get();

    expect($result->ids)->toBe([])->and($result->total)->toBe(0);
});

it('фильтр по категории охватывает всё поддерево', function () {
    $guitar = ListingFixtures::published(city: moscow());
    $pedal = ListingFixtures::published(
        ['title' => 'Boss DS-1'],
        moscow(),
        ListingFixtures::pedals(),
    );

    expect(searchIn(moscow())->inCategory('gitary')->get()->ids)->toBe([$guitar->id])
        ->and(searchIn(moscow())->inCategory('gitary/elektrogitary')->get()->ids)->toBe([$guitar->id])
        ->and(searchIn(moscow())->inCategory('pedali-i-usiliteli')->get()->ids)->toBe([$pedal->id])
        ->and(searchIn(moscow())->inCategory(ListingFixtures::pedals())->get()->ids)->toBe([$pedal->id]);
});

it('фильтр по состоянию принимает несколько ступеней BR-02', function () {
    $mint = ListingFixtures::published(['condition' => Condition::Mint->value], moscow());
    $good = ListingFixtures::published(['condition' => Condition::Good->value], moscow());
    ListingFixtures::published(['condition' => Condition::Poor->value], moscow());

    $ids = searchIn(moscow())->conditions([Condition::Mint, Condition::Good])->get()->ids;

    expect($ids)->toEqualCanonicalizing([$mint->id, $good->id]);
});

it('фильтр по цене: границы включительно', function () {
    $cheap = ListingFixtures::published(['price' => 10_000], moscow());
    $middle = ListingFixtures::published(['price' => 50_000], moscow());
    ListingFixtures::published(['price' => 120_000], moscow());

    expect(searchIn(moscow())->priceBetween(10_000, 50_000)->get()->ids)->toEqualCanonicalizing([$cheap->id, $middle->id])
        ->and(searchIn(moscow())->priceBetween(null, 9_999)->get()->ids)->toBe([])
        ->and(searchIn(moscow())->priceBetween(50_001, null)->get()->total)->toBe(1);
});

it('фильтры «доставка» и «торг»', function () {
    $ship = ListingFixtures::published(['ship' => true, 'negotiable' => false], moscow());
    $bargain = ListingFixtures::published(['ship' => false, 'negotiable' => true], moscow());

    expect(searchIn(moscow())->withShipping()->get()->ids)->toBe([$ship->id])
        ->and(searchIn(moscow())->negotiable()->get()->ids)->toBe([$bargain->id])
        ->and(searchIn(moscow())->get()->total)->toBe(2);
});

it('сортировки: новые, цена по возрастанию и убыванию', function () {
    $this->travelTo(now()->subDays(3));
    $oldest = ListingFixtures::published(['price' => 30_000], moscow());
    $this->travelTo(now()->addDay());
    $middle = ListingFixtures::published(['price' => 10_000], moscow());
    $this->travelTo(now()->addDay());
    $newest = ListingFixtures::published(['price' => 20_000], moscow());
    $this->travelBack();

    expect(searchIn(moscow())->sortBy(ListingSort::Newest)->get()->ids)->toBe([$newest->id, $middle->id, $oldest->id])
        ->and(searchIn(moscow())->sortBy(ListingSort::PriceAsc)->get()->ids)->toBe([$middle->id, $newest->id, $oldest->id])
        ->and(searchIn(moscow())->sortBy(ListingSort::PriceDesc)->get()->ids)->toBe([$oldest->id, $newest->id, $middle->id]);
});

it('сортировка по цене главнее релевантности среди совпавших по всем словам', function () {
    $dear = ListingFixtures::published(['title' => 'Fender Stratocaster', 'price' => 200_000], moscow());
    $cheap = ListingFixtures::published(['title' => 'Fender Stratocaster Mexico', 'price' => 50_000], moscow());

    $ids = searchIn(moscow())->matching('stratocaster')->sortBy(ListingSort::PriceAsc)->get()->ids;

    expect($ids)->toBe([$cheap->id, $dear->id]);
});

it('сортировки «рядом» нет: ни в перечислении, ни в параметрах запроса', function () {
    $sorts = array_map(fn (ListingSort $sort): string => $sort->value, ListingSort::cases());

    expect($sorts)->toBe(['relevance', 'published_at:desc', 'price:asc', 'price:desc'])
        ->and((new ReflectionMethod(ListingSearch::class, 'sortBy'))->getNumberOfParameters())->toBe(1);
});

it('цена по возрастанию: «Договорная» (price = null) в конце, бесплатное первым (BR-11)', function () {
    $free = ListingFixtures::published(['price' => 0], moscow());
    $cheap = ListingFixtures::published(['price' => 5_000], moscow());
    $unpriced = ListingFixtures::published(['price' => null], moscow());

    expect(searchIn(moscow())->sortBy(ListingSort::PriceAsc)->get()->ids)->toBe([$free->id, $cheap->id, $unpriced->id])
        ->and(searchIn(moscow())->sortBy(ListingSort::PriceDesc)->get()->ids)->toBe([$cheap->id, $free->id, $unpriced->id]);
});

it('категория в filter экранируется: кавычка и обратная косая не выходят из строки', function (string $category) {
    ListingFixtures::published(city: moscow());

    $result = searchIn(moscow())->inCategory($category)->get();

    expect($result->total)->toBe(0)
        ->and($result->ids)->toBe([]);
})->with([
    'кавычка и OR' => ['x" OR city_id != 0 OR category_path = "'],
    'обратная косая в конце' => ['a\\'],
    'косая и кавычка' => ['a\\" OR city_id != 0 OR category_path = "'],
]);

it('фасеты считаются по выдаче города: состояние и категория', function () {
    ListingFixtures::published(['condition' => 'mint'], moscow());
    ListingFixtures::published(['condition' => 'mint'], moscow());
    ListingFixtures::published(['condition' => 'good'], moscow());
    ListingFixtures::published(['condition' => 'poor'], kazan());
    ListingFixtures::published(['condition' => 'good'], moscow(), ListingFixtures::pedals());

    $facets = searchIn(moscow())->get()->facets;

    expect($facets['condition'])->toEqual(['good' => 2, 'mint' => 2])
        ->and($facets['category_path']['gitary'])->toBe(3)
        ->and($facets['category_path']['gitary/elektrogitary'])->toBe(3)
        ->and($facets['category_path']['pedali-i-usiliteli'])->toBe(1);
});

it('страницы: общее число точное, страница отдаёт срез', function () {
    foreach (range(1, 5) as $price) {
        ListingFixtures::published(['price' => $price * 1_000], moscow());
    }

    $first = searchIn(moscow())->sortBy(ListingSort::PriceAsc)->get(page: 1, perPage: 2);
    $last = searchIn(moscow())->sortBy(ListingSort::PriceAsc)->get(page: 3, perPage: 2);

    expect($first->total)->toBe(5)
        ->and($first->ids)->toHaveCount(2)
        ->and($first->page)->toBe(1)
        ->and($last->ids)->toHaveCount(1)
        ->and($last->hits[0]['price'])->toBe(5_000);
});

it('выдача отдаёт только поля индекса без серийного номера и владельца', function () {
    ListingFixtures::published(city: moscow());

    $hit = searchIn(moscow())->get()->hits[0];

    expect(array_keys($hit))->not->toContain('serial_enc', 'user_id', 'email', 'final_price');
});
