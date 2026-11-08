<?php

declare(strict_types=1);

use App\Domain\Catalog\Models\City;
use Database\Seeders\CitySeeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Symfony\Component\HttpFoundation\Response;
use Tests\Support\ListingFixtures;
use Tests\Support\MeilisearchIndex;

// UC-S2 (карточка 3.1.4): главная показывает свежие объявления города шапки (BR-01) двумя рельсами:
// «Новые в {городе}» и «Готовы к торгу». Кэш блоков — 60 с на город. Meilisearch настоящий.

beforeEach(function () {
    $this->seed(CitySeeder::class);
    MeilisearchIndex::resetListings();
});

function homeCity(string $name): City
{
    return City::query()->where('name', $name)->firstOrFail();
}

/**
 * Опубликованное объявление города; каждое следующее — на секунду позже, чтобы порядок «новые» был определён.
 *
 * @param  array<string, mixed>  $attributes
 */
function homeListing(array $attributes = [], string $city = 'Москва'): string
{
    currentTest()->travel(1)->seconds();

    return ListingFixtures::published($attributes, homeCity($city))->id;
}

/** @return TestResponse<Response> */
function homeGet(string $city = 'Москва'): TestResponse
{
    MeilisearchIndex::waitForTasks();

    return currentTest()->withCookie('ym_city', (string) homeCity($city)->id)->get('/');
}

it('отдаёт рельс «Новые в городе»: объявления города шапки, свежие первыми, не больше 10', function () {
    $ids = [];
    foreach (range(1, 12) as $i) {
        $ids[] = homeListing(['title' => "Гитара {$i}"]);
    }
    homeListing(['title' => 'Казанская'], 'Казань');

    homeGet()
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Home')
            ->has('rails.fresh', 10)
            ->where('rails.fresh.0.id', $ids[11])
            ->where('rails.fresh.9.id', $ids[2])
            ->where('rails.fresh.0.city', 'Москва'));
});

it('рельс «Готовы к торгу» — только с «Готов к торгу»', function () {
    $negotiable = homeListing(['title' => 'Торг', 'negotiable' => true, 'price' => 50_000]);
    homeListing(['title' => 'Без торга', 'negotiable' => false, 'price' => 60_000]);
    homeListing(['title' => 'Договорная', 'negotiable' => false, 'price' => null]);

    homeGet()->assertInertia(fn (Assert $page) => $page
        ->has('rails.fresh', 3)
        ->has('rails.negotiable', 1)
        ->where('rails.negotiable.0.id', $negotiable)
        ->where('rails.negotiable.0.negotiable', true));
});

it('цена без суммы доходит до карточки как null и 0, а не как «0 ₽» (BR-11)', function () {
    homeListing(['title' => 'Договорная', 'negotiable' => false, 'price' => null]);
    homeListing(['title' => 'Даром', 'negotiable' => false, 'price' => 0]);

    homeGet()->assertInertia(fn (Assert $page) => $page
        ->where('rails.fresh.0.price', 0)
        ->where('rails.fresh.1.price', null));
});

it('карточки рельсов — белый список полей: без серийного номера, почты, user_id, описания', function () {
    homeListing(['serial_enc' => 'V091234', 'description' => 'Секретное описание']);

    $response = homeGet();
    $rails = $response->viewData('page')['props']['rails'];

    expect(array_keys($rails['fresh'][0]))
        ->toEqualCanonicalizing(['id', 'title', 'price', 'condition', 'city', 'ship', 'negotiable', 'posted'])
        ->and(json_encode($rails))->not->toContain('V091234')->not->toContain('Секретное описание');
});

it('город берётся из cookie выбора; в другом городе — его объявления', function () {
    homeListing(['title' => 'Москва'], 'Москва');
    $kazan = homeListing(['title' => 'Казань'], 'Казань');

    homeGet('Казань')->assertInertia(fn (Assert $page) => $page
        ->has('rails.fresh', 1)
        ->where('rails.fresh.0.id', $kazan));
});

it('в городе без объявлений оба рельса пусты: страница заменит их ссылкой', function () {
    homeListing(['title' => 'Москва'], 'Москва');

    homeGet('Казань')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('rails.fresh', 0)
        ->has('rails.negotiable', 0));
});

it('без города в справочнике главная открывается с пустыми рельсами', function () {
    City::query()->delete();

    $this->get('/')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('rails.fresh', 0)
        ->has('rails.negotiable', 0));
});

it('рельсы кэшируются на 60 секунд на город', function () {
    homeListing(['title' => 'Первое']);
    homeGet()->assertInertia(fn (Assert $page) => $page->has('rails.fresh', 1));

    homeListing(['title' => 'Второе']);
    $this->travel(30)->seconds();
    homeGet()->assertInertia(fn (Assert $page) => $page->has('rails.fresh', 1));

    // Другой город кэш не делит.
    homeListing(['title' => 'Казань'], 'Казань');
    homeGet('Казань')->assertInertia(fn (Assert $page) => $page->has('rails.fresh', 1));

    $this->travel(31)->seconds();
    homeGet()->assertInertia(fn (Assert $page) => $page->has('rails.fresh', 2));
});

it('число запросов к БД не растёт с числом карточек (без N+1)', function () {
    $count = function (): int {
        $queries = 0;
        DB::listen(function () use (&$queries): void {
            $queries++;
        });
        homeGet()->assertOk();

        return $queries;
    };

    homeListing();
    $few = $count();
    Cache::flush();
    foreach (range(1, 9) as $i) {
        homeListing(['title' => "Ещё {$i}"]);
    }
    $many = $count();

    expect($many)->toBe($few);
});

it('у карточки есть давность публикации', function () {
    homeListing();

    homeGet()->assertInertia(fn (Assert $page) => $page
        ->where('rails.fresh.0.posted', fn (mixed $posted) => is_string($posted) && $posted !== ''));
});
