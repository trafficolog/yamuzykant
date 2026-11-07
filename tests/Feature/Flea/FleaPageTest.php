<?php

declare(strict_types=1);

use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\City;
use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use App\Http\Middleware\HandleInertiaRequests;
use Database\Seeders\CitySeeder;
use Illuminate\Testing\Fluent\AssertableJson;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\ListingFixtures;
use Tests\Support\MeilisearchIndex;

// UC-S2, UC-S3 (карточка 3.1.2): /baraholka и /baraholka/{категория}. Город — из шапки (BR-01), фильтры — в адресе.
// Meilisearch настоящий (сервис CI); индексация ждёт очереди задач перед запросом страницы.

beforeEach(function () {
    $this->seed(CitySeeder::class);
    MeilisearchIndex::resetListings();
});

function fleaCity(string $name): City
{
    return City::query()->where('name', $name)->firstOrFail();
}

/** Опубликованное объявление в Москве (по умолчанию), примеры из прототипа. */
function fleaListing(array $attributes = [], string $city = 'Москва', ?Category $category = null): string
{
    return ListingFixtures::published($attributes, fleaCity($city), $category)->id;
}

function fleaGet(string $uri): Illuminate\Testing\TestResponse
{
    MeilisearchIndex::waitForTasks();

    return test()->get($uri);
}

it('отдаёт страницу Flea/Index с объявлениями города шапки и только города шапки', function () {
    $moscow = fleaListing(['title' => 'Fender ’57 Stratocaster']);
    fleaListing(['title' => 'Gibson Les Paul'], 'Казань');

    fleaGet('/baraholka')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Flea/Index')
            ->has('listings', 1)
            ->where('listings.0.id', $moscow)
            ->where('listings.0.city', 'Москва')
            ->where('pagination.total', 1));
});

it('город берётся из cookie выбора, а не из фильтра', function () {
    fleaListing(['title' => 'Москва'], 'Москва');
    $kazan = fleaListing(['title' => 'Казань'], 'Казань');
    MeilisearchIndex::waitForTasks();

    $this->withCookie('ym_city', (string) fleaCity('Казань')->id)
        ->get('/baraholka')
        ->assertInertia(fn (Assert $page) => $page
            ->has('listings', 1)
            ->where('listings.0.id', $kazan));
});

it('карточка в props — белый список полей: без серийного номера, почты, user_id и итоговой цены', function () {
    fleaListing(['serial_enc' => 'V091234']);

    fleaGet('/baraholka')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('listings.0', fn (AssertableJson $card) => $card
                ->has('id')
                ->where('title', 'Fender ’57 Stratocaster')
                ->where('price', 184_500)
                ->where('condition', 'excellent')
                ->where('city', 'Москва')
                ->where('ship', false)
                ->where('negotiable', true)
                ->has('posted')
                ->etc()));

    $content = (string) fleaGet('/baraholka')->getContent();
    expect($content)->not->toContain('V091234')
        ->not->toContain('serial_enc')
        ->not->toContain('user_id')
        ->not->toContain('final_price')
        ->not->toContain('test@example.com');
});

it('карточка содержит ровно восемь полей', function () {
    fleaListing();

    fleaGet('/baraholka')->assertInertia(fn (Assert $page) => $page
        ->where('listings.0', fn ($card) => array_keys((array) $card) === [
            'id', 'title', 'price', 'condition', 'city', 'ship', 'negotiable', 'posted',
        ]));
});

it('категория из адреса: вся ветка, заголовок и крошки', function () {
    $guitars = ListingFixtures::electricGuitars();
    $pedals = ListingFixtures::pedals();
    $guitar = fleaListing(['title' => 'Гитара'], category: $guitars);
    fleaListing(['title' => 'Педаль'], category: $pedals);

    fleaGet('/baraholka/gitary/elektrogitary')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Flea/Index')
            ->has('listings', 1)
            ->where('listings.0.id', $guitar)
            ->where('category.name', 'Электрогитары')
            ->where('category.path', 'gitary/elektrogitary')
            ->where('category.crumbs', [
                ['name' => 'Гитары', 'path' => 'gitary'],
                ['name' => 'Электрогитары', 'path' => 'gitary/elektrogitary'],
            ]));

    fleaGet('/baraholka/gitary')->assertInertia(fn (Assert $page) => $page
        ->has('listings', 1)
        ->where('category.name', 'Гитары'));
});

it('без категории выдача по всем, category = null', function () {
    fleaListing(category: ListingFixtures::electricGuitars());
    fleaListing(category: ListingFixtures::pedals());

    fleaGet('/baraholka')->assertInertia(fn (Assert $page) => $page
        ->has('listings', 2)
        ->where('category', null));
});

it('неизвестная и скрытая категории — 404', function () {
    ListingFixtures::electricGuitars();
    Category::query()->where('slug', 'elektrogitary')->update(['is_visible' => false]);

    $this->get('/baraholka/net-takoy')->assertNotFound();
    $this->get('/baraholka/gitary/net-takoy')->assertNotFound();
    $this->get('/baraholka/gitary/elektrogitary')->assertNotFound();
    $this->get('/baraholka/gitary/%22%20OR%201=1')->assertNotFound();
});

it('счётчики категорий приходят по пути категории', function () {
    fleaListing(category: ListingFixtures::electricGuitars());
    fleaListing(category: ListingFixtures::electricGuitars());
    fleaListing(category: ListingFixtures::pedals());

    fleaGet('/baraholka')->assertInertia(fn (Assert $page) => $page
        ->where('categoryCounts.gitary', 2)
        ->where('categoryCounts.gitary/elektrogitary', 2)
        ->where('categoryCounts.pedali-i-usiliteli', 1));
});

describe('маппинг query → фильтры', function () {
    beforeEach(function () {
        $this->excellent = fleaListing(['title' => 'A excellent', 'condition' => 'excellent', 'price' => 184_500, 'negotiable' => true, 'ship' => false]);
        $this->good = fleaListing(['title' => 'B good', 'condition' => 'good', 'price' => 90_000, 'negotiable' => false, 'ship' => true]);
        $this->mint = fleaListing(['title' => 'C mint', 'condition' => 'mint', 'price' => 50_000, 'negotiable' => false, 'ship' => false]);
    });

    it('condition[] — состояние (несколько значений)', function () {
        fleaGet('/baraholka?condition[]=excellent&condition[]=good')->assertInertia(fn (Assert $page) => $page
            ->where('listings', fn ($cards) => collect($cards)->pluck('id')->sort()->values()->all()
                === collect([$this->excellent, $this->good])->sort()->values()->all())
            ->where('filters.condition', ['excellent', 'good']));
    });

    it('price_from и price_to — цена включительно', function () {
        fleaGet('/baraholka?price_from=50000&price_to=90000')->assertInertia(fn (Assert $page) => $page
            ->has('listings', 2)
            ->where('filters.priceFrom', 50_000)
            ->where('filters.priceTo', 90_000));
    });

    it('negotiable=1 — только «Готов к торгу»', function () {
        fleaGet('/baraholka?negotiable=1')->assertInertia(fn (Assert $page) => $page
            ->has('listings', 1)
            ->where('listings.0.id', $this->excellent)
            ->where('filters.negotiable', true));
    });

    it('ship=1 — только с доставкой', function () {
        fleaGet('/baraholka?ship=1')->assertInertia(fn (Assert $page) => $page
            ->has('listings', 1)
            ->where('listings.0.id', $this->good)
            ->where('listings.0.ship', true)
            ->where('filters.ship', true));
    });

    it('sort=cheap и sort=expensive упорядочивают по цене', function () {
        fleaGet('/baraholka?sort=cheap')->assertInertia(fn (Assert $page) => $page
            ->where('listings.0.id', $this->mint)
            ->where('listings.2.id', $this->excellent)
            ->where('filters.sort', 'cheap'));

        fleaGet('/baraholka?sort=expensive')->assertInertia(fn (Assert $page) => $page
            ->where('listings.0.id', $this->excellent)
            ->where('listings.2.id', $this->mint));
    });

    it('без sort — сначала новые', function () {
        fleaGet('/baraholka')->assertInertia(fn (Assert $page) => $page
            ->where('filters.sort', null)
            ->where('listings.0.id', $this->mint));
    });

    it('q — поиск по названию в выдаче города', function () {
        fleaGet('/baraholka?q=excellent')->assertInertia(fn (Assert $page) => $page
            ->has('listings', 1)
            ->where('listings.0.id', $this->excellent)
            ->where('filters.q', 'excellent'));
    });

    it('фильтры складываются', function () {
        fleaGet('/baraholka?condition[]=good&condition[]=excellent&ship=1&price_to=100000')->assertInertia(fn (Assert $page) => $page
            ->has('listings', 1)
            ->where('listings.0.id', $this->good));
    });

    it('мусор в query не роняет страницу и не фильтрует', function () {
        fleaGet('/baraholka?condition[]=zzz&price_from=abc&sort=nearest&page=-3&ship=maybe&q[]=1')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('listings', 3)
                ->where('filters.condition', [])
                ->where('filters.sort', null)
                ->where('pagination.page', 1));
    });

    it('сортировки «рядом» на странице нет: ни в запросе, ни в списке сортировок', function () {
        fleaGet('/baraholka?sort=nearest')->assertInertia(fn (Assert $page) => $page
            ->where('filters.sort', null)
            ->where('sorts', ['new', 'cheap', 'expensive']));
    });

    it('чипы состояний: все 8 ступеней BR-02 с числом объявлений, счётчик не зависит от выбранного состояния', function () {
        fleaGet('/baraholka?condition[]=excellent')->assertInertia(fn (Assert $page) => $page
            ->has('conditions', 8)
            ->where('conditions.0', ['value' => 'new', 'label' => 'Новое', 'count' => 0])
            ->where('conditions.1', ['value' => 'mint', 'label' => 'Как новое', 'count' => 1])
            ->where('conditions.2', ['value' => 'excellent', 'label' => 'Отличное', 'count' => 1])
            ->where('conditions.4', ['value' => 'good', 'label' => 'Хорошее', 'count' => 1])
            ->has('listings', 1));
    });
});

describe('страницы', function () {
    beforeEach(function () {
        for ($i = 1; $i <= 30; $i++) {
            fleaListing(['title' => sprintf('Гитара %02d', $i), 'price' => 10_000 + $i]);
        }
    });

    it('24 карточки на страницу, точное число и число страниц', function () {
        fleaGet('/baraholka?sort=cheap')->assertInertia(fn (Assert $page) => $page
            ->has('listings', 24)
            ->where('pagination', ['page' => 1, 'pages' => 2, 'total' => 30, 'perPage' => 24]));
    });

    it('page=2 — остаток выдачи', function () {
        fleaGet('/baraholka?sort=cheap&page=2')->assertInertia(fn (Assert $page) => $page
            ->has('listings', 6)
            ->where('listings.0.title', 'Гитара 25')
            ->where('pagination.page', 2));
    });

    it('страница за пределами выдачи — пустой список, а не ошибка', function () {
        fleaGet('/baraholka?page=99')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('listings', 0)
            ->where('pagination.total', 30));
    });

    it('«Показать ещё» — частичный запрос: listings дописываются к уже загруженным, pagination заменяется', function () {
        MeilisearchIndex::waitForTasks();

        $response = $this->get('/baraholka?sort=cheap&page=2', [
            'X-Inertia' => 'true',
            'X-Inertia-Version' => (string) app(HandleInertiaRequests::class)->version(request()),
            'X-Inertia-Partial-Component' => 'Flea/Index',
            'X-Inertia-Partial-Data' => 'listings,pagination',
        ]);

        $response->assertOk();
        expect($response->json('mergeProps'))->toContain('listings')
            ->and($response->json('props.listings'))->toHaveCount(6)
            ->and($response->json('props.pagination.page'))->toBe(2);
    });
});

it('пустая выдача: пустой список и нулевой счётчик', function () {
    fleaGet('/baraholka')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('listings', 0)
        ->where('pagination', ['page' => 1, 'pages' => 0, 'total' => 0, 'perPage' => 24]));
});

it('флаги вне MVP выключены: CatalogSwitch и «Безопасная сделка» не показываются', function () {
    fleaGet('/baraholka')->assertInertia(fn (Assert $page) => $page
        ->where('flags.catalog_new', false)
        ->where('flags.safe_deal', false));
});

it('снятое объявление в выдачу не попадает', function () {
    $listing = Listing::query()->findOrFail(fleaListing());
    fleaGet('/baraholka')->assertInertia(fn (Assert $page) => $page->has('listings', 1));

    app(ListingStateMachine::class)->withdraw($listing, WithdrawReason::SoldElsewhere);

    fleaGet('/baraholka')->assertInertia(fn (Assert $page) => $page->has('listings', 0));
});
