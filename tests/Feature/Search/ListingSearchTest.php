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
    $this->moscow = ListingFixtures::city('Москва', 55.7558, 37.6173);
    $this->kazan = ListingFixtures::city('Казань', 55.7887, 49.1221);
});

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
    $inMoscow = ListingFixtures::published(city: $this->moscow);
    ListingFixtures::published(city: $this->kazan);

    $result = searchIn($this->moscow)->get();

    expect($result->ids)->toBe([$inMoscow->id])
        ->and($result->total)->toBe(1);
});

it('снятое объявление пропадает из выдачи', function () {
    $listing = ListingFixtures::published(city: $this->moscow);
    expect(searchIn($this->moscow)->get()->total)->toBe(1);

    app(ListingStateMachine::class)->withdraw($listing, WithdrawReason::SoldElsewhere);

    expect(searchIn($this->moscow)->get()->total)->toBe(0);
});

it('находит по названию, модели, бренду и описанию', function (string $query) {
    $listing = ListingFixtures::published([
        'title' => 'Гитара в отличном состоянии',
        'description' => 'Родной чехол, свежие струны Ernie Ball.',
    ], $this->moscow);

    expect(searchIn($this->moscow)->matching($query)->get()->ids)->toBe([$listing->id]);
})->with([
    'по названию' => 'отличном',
    'по модели' => 'American Vintage',
    'по бренду' => 'Fender',
    'по описанию' => 'Ernie',
]);

it('опечатка в одну букву не мешает найти', function () {
    $listing = ListingFixtures::published(city: $this->moscow);

    expect(searchIn($this->moscow)->matching('Stratocastr')->get()->ids)->toBe([$listing->id])
        ->and(searchIn($this->moscow)->matching('Fendr')->get()->ids)->toBe([$listing->id]);
});

it('русское написание «стратокастер» находит Stratocaster (синонимы 1.2.2)', function () {
    $listing = ListingFixtures::published(['title' => 'Электрогитара'], $this->moscow);

    expect(searchIn($this->moscow)->matching('стратокастер')->get()->ids)->toBe([$listing->id]);
});

it('запрос, которого нет в объявлениях, возвращает пустую выдачу', function () {
    ListingFixtures::published(city: $this->moscow);

    $result = searchIn($this->moscow)->matching('саксофон')->get();

    expect($result->ids)->toBe([])->and($result->total)->toBe(0);
});

it('фильтр по категории охватывает всё поддерево', function () {
    $guitar = ListingFixtures::published(city: $this->moscow);
    $pedal = ListingFixtures::published(
        ['title' => 'Boss DS-1'],
        $this->moscow,
        ListingFixtures::pedals(),
    );

    expect(searchIn($this->moscow)->inCategory('gitary')->get()->ids)->toBe([$guitar->id])
        ->and(searchIn($this->moscow)->inCategory('gitary/elektrogitary')->get()->ids)->toBe([$guitar->id])
        ->and(searchIn($this->moscow)->inCategory('pedali-i-usiliteli')->get()->ids)->toBe([$pedal->id])
        ->and(searchIn($this->moscow)->inCategory(ListingFixtures::pedals())->get()->ids)->toBe([$pedal->id]);
});

it('фильтр по состоянию принимает несколько ступеней BR-02', function () {
    $mint = ListingFixtures::published(['condition' => Condition::Mint->value], $this->moscow);
    $good = ListingFixtures::published(['condition' => Condition::Good->value], $this->moscow);
    ListingFixtures::published(['condition' => Condition::Poor->value], $this->moscow);

    $ids = searchIn($this->moscow)->conditions([Condition::Mint, Condition::Good])->get()->ids;

    expect($ids)->toEqualCanonicalizing([$mint->id, $good->id]);
});

it('фильтр по цене: границы включительно', function () {
    $cheap = ListingFixtures::published(['price' => 10_000], $this->moscow);
    $middle = ListingFixtures::published(['price' => 50_000], $this->moscow);
    ListingFixtures::published(['price' => 120_000], $this->moscow);

    expect(searchIn($this->moscow)->priceBetween(10_000, 50_000)->get()->ids)->toEqualCanonicalizing([$cheap->id, $middle->id])
        ->and(searchIn($this->moscow)->priceBetween(null, 9_999)->get()->ids)->toBe([])
        ->and(searchIn($this->moscow)->priceBetween(50_001, null)->get()->total)->toBe(1);
});

it('фильтры «доставка» и «торг»', function () {
    $ship = ListingFixtures::published(['ship' => true, 'negotiable' => false], $this->moscow);
    $bargain = ListingFixtures::published(['ship' => false, 'negotiable' => true], $this->moscow);

    expect(searchIn($this->moscow)->withShipping()->get()->ids)->toBe([$ship->id])
        ->and(searchIn($this->moscow)->negotiable()->get()->ids)->toBe([$bargain->id])
        ->and(searchIn($this->moscow)->get()->total)->toBe(2);
});

it('сортировки: новые, цена по возрастанию и убыванию', function () {
    $this->travelTo(now()->subDays(3));
    $oldest = ListingFixtures::published(['price' => 30_000], $this->moscow);
    $this->travelTo(now()->addDay());
    $middle = ListingFixtures::published(['price' => 10_000], $this->moscow);
    $this->travelTo(now()->addDay());
    $newest = ListingFixtures::published(['price' => 20_000], $this->moscow);
    $this->travelBack();

    expect(searchIn($this->moscow)->sortBy(ListingSort::Newest)->get()->ids)->toBe([$newest->id, $middle->id, $oldest->id])
        ->and(searchIn($this->moscow)->sortBy(ListingSort::PriceAsc)->get()->ids)->toBe([$middle->id, $newest->id, $oldest->id])
        ->and(searchIn($this->moscow)->sortBy(ListingSort::PriceDesc)->get()->ids)->toBe([$oldest->id, $newest->id, $middle->id]);
});

it('сортировка по цене главнее релевантности среди совпавших по всем словам', function () {
    $dear = ListingFixtures::published(['title' => 'Fender Stratocaster', 'price' => 200_000], $this->moscow);
    $cheap = ListingFixtures::published(['title' => 'Fender Stratocaster Mexico', 'price' => 50_000], $this->moscow);

    $ids = searchIn($this->moscow)->matching('stratocaster')->sortBy(ListingSort::PriceAsc)->get()->ids;

    expect($ids)->toBe([$cheap->id, $dear->id]);
});

it('сортировка «рядом» отдаёт расстояние до точки пользователя', function () {
    ListingFixtures::published(city: $this->moscow);

    $result = searchIn($this->moscow)->sortBy(ListingSort::Nearest, lat: 55.75, lng: 37.62)->get();

    expect($result->total)->toBe(1)
        ->and($result->hits[0]['_geoDistance'])->toBeInt()->toBeLessThan(2_000);
});

it('сортировка «рядом» без точки — ошибка вызова', function () {
    expect(fn () => ListingSearch::inCity($this->moscow)->sortBy(ListingSort::Nearest))
        ->toThrow(InvalidArgumentException::class);
});

it('фасеты считаются по выдаче города: состояние и категория', function () {
    ListingFixtures::published(['condition' => 'mint'], $this->moscow);
    ListingFixtures::published(['condition' => 'mint'], $this->moscow);
    ListingFixtures::published(['condition' => 'good'], $this->moscow);
    ListingFixtures::published(['condition' => 'poor'], $this->kazan);
    ListingFixtures::published(['condition' => 'good'], $this->moscow, ListingFixtures::pedals());

    $facets = searchIn($this->moscow)->get()->facets;

    expect($facets['condition'])->toBe(['good' => 2, 'mint' => 2])
        ->and($facets['category_path']['gitary'])->toBe(3)
        ->and($facets['category_path']['gitary/elektrogitary'])->toBe(3)
        ->and($facets['category_path']['pedali-i-usiliteli'])->toBe(1);
});

it('страницы: общее число точное, страница отдаёт срез', function () {
    foreach (range(1, 5) as $price) {
        ListingFixtures::published(['price' => $price * 1_000], $this->moscow);
    }

    $first = searchIn($this->moscow)->sortBy(ListingSort::PriceAsc)->get(page: 1, perPage: 2);
    $last = searchIn($this->moscow)->sortBy(ListingSort::PriceAsc)->get(page: 3, perPage: 2);

    expect($first->total)->toBe(5)
        ->and($first->ids)->toHaveCount(2)
        ->and($first->page)->toBe(1)
        ->and($last->ids)->toHaveCount(1)
        ->and($last->hits[0]['price'])->toBe(5_000);
});

it('выдача отдаёт только поля индекса без серийного номера и владельца', function () {
    ListingFixtures::published(city: $this->moscow);

    $hit = searchIn($this->moscow)->get()->hits[0];

    expect(array_keys($hit))->not->toContain('serial_enc', 'user_id', 'email', 'final_price');
});
