<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\SaleRecord;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\ListingFixtures;
use Tests\Support\MeilisearchIndex;

// 3.1.6, UC-V2: страница продавца `/sellers/{id}`. Публично только опубликованное (SPEC §6.1); «продано» —
// без цен (BR-11, итоговая цена не публична); почты и yandex_id нет (BR-04); заблокированный продавец — 404.

beforeEach(function () {
    MeilisearchIndex::resetListings();
});

/** @param  array<string, mixed>  $attributes */
function sellerListing(User $seller, ListingStatus $status, array $attributes = []): Listing
{
    return Listing::factory()
        ->inStatus($status)
        ->for($seller)
        ->create(array_merge(['city_id' => ListingFixtures::city()->id], $attributes));
}

function soldListing(User $seller, WithdrawReason $reason, string $title = 'Проданная гитара'): Listing
{
    $listing = sellerListing($seller, ListingStatus::Withdrawn, ['title' => $title]);
    SaleRecord::query()->create(['listing_id' => $listing->id, 'reason' => $reason, 'final_price' => 150_000, 'sold_at' => now()->subDay()]);

    return $listing;
}

it('отдаёт гостю страницу продавца: имя, город с типом, «с года», число продаж', function () {
    $seller = User::factory()->create(['name' => 'Гитарный угол', 'city_id' => ListingFixtures::city('Казань')->id]);
    sellerListing($seller, ListingStatus::Published);
    soldListing($seller, WithdrawReason::SoldHere);
    soldListing($seller, WithdrawReason::SoldElsewhere);

    $this->get("/sellers/{$seller->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Seller/Show')
            ->where('seller.id', $seller->id)
            ->where('seller.name', 'Гитарный угол')
            ->where('seller.city', ['type' => 'г.', 'name' => 'Казань'])
            ->where('seller.since', $seller->created_at?->year)
            ->where('tab', 'sale')
            ->where('counts', ['sale' => 1, 'sold' => 2])
            ->etc());
});

it('вкладка «В продаже» — только опубликованные; черновик, проверка, доработка, истёкшее и снятое не видны', function () {
    $seller = User::factory()->create();
    $published = sellerListing($seller, ListingStatus::Published, ['title' => 'Опубликованная']);
    foreach ([ListingStatus::Draft, ListingStatus::Pending, ListingStatus::NeedsChanges, ListingStatus::Rejected, ListingStatus::Expired, ListingStatus::Withdrawn] as $status) {
        sellerListing($seller, $status, ['title' => "Скрытая {$status->value}"]);
    }
    sellerListing(User::factory()->create(), ListingStatus::Published, ['title' => 'Чужая']);

    $this->get("/sellers/{$seller->id}")->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('listings', 1)
        ->where('listings.0.id', $published->id)
        ->where('listings.0.title', 'Опубликованная')
        ->where('sold', [])
        ->where('counts.sale', 1)
        ->etc());
});

it('карточка в продаже — тот же белый список, что у «Похожих» на лоте: без user_id и итоговой цены', function () {
    $seller = User::factory()->create();
    sellerListing($seller, ListingStatus::Published, ['price' => null]);

    $this->get("/sellers/{$seller->id}")->assertInertia(fn (Assert $page) => $page
        ->has('listings.0', fn (Assert $card) => $card->hasAll(['id', 'title', 'price', 'condition', 'city', 'ship', 'negotiable', 'posted', 'image']))
        ->where('listings.0.price', null)
        ->etc());
});

it('вкладка «Продано» — только проданные (здесь или в другом месте), без цен', function () {
    $seller = User::factory()->create();
    sellerListing($seller, ListingStatus::Published);
    soldListing($seller, WithdrawReason::SoldHere, 'Продана здесь');
    soldListing($seller, WithdrawReason::SoldElsewhere, 'Продана в другом месте');
    soldListing($seller, WithdrawReason::ChangedMind, 'Передумал');
    soldListing($seller, WithdrawReason::Moderation, 'Снята модерацией');

    $response = $this->get("/sellers/{$seller->id}?tab=sold")->assertOk();
    $response->assertInertia(fn (Assert $page) => $page
        ->where('tab', 'sold')
        ->has('sold', 2)
        ->has('sold.0', fn (Assert $item) => $item->hasAll(['id', 'title', 'city', 'sold']))
        ->where('listings', [])
        ->where('counts', ['sale' => 1, 'sold' => 2])
        ->etc());

    $props = json_encode($response->viewData('page')['props'], JSON_THROW_ON_ERROR);
    expect($props)->not->toContain('150000')
        ->and($props)->not->toContain('final_price')
        ->and($props)->not->toContain('Передумал')
        ->and($props)->not->toContain('Снята модерацией');
});

it('неизвестная вкладка — «В продаже»', function () {
    $seller = User::factory()->create();

    $this->get("/sellers/{$seller->id}?tab=whatever")->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('tab', 'sale')->etc());
});

it('пагинация: 24 карточки на странице, вторая страница — остаток', function () {
    $seller = User::factory()->create();
    $city = ListingFixtures::city();
    Listing::factory()->count(26)->inStatus(ListingStatus::Published)->for($seller)->create(['city_id' => $city->id]);

    $this->get("/sellers/{$seller->id}")->assertInertia(fn (Assert $page) => $page
        ->has('listings', 24)
        ->where('pagination', ['page' => 1, 'pages' => 2])
        ->etc());
    $this->get("/sellers/{$seller->id}?page=2")->assertInertia(fn (Assert $page) => $page
        ->has('listings', 2)
        ->where('pagination.page', 2)
        ->etc());
});

it('продавец без объявлений: страница открыта, списки пусты', function () {
    $seller = User::factory()->create();

    $this->get("/sellers/{$seller->id}")->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('listings', [])
            ->where('counts', ['sale' => 0, 'sold' => 0])
            ->where('pagination', ['page' => 1, 'pages' => 1])
            ->etc());
});

it('заблокированный продавец и несуществующий адрес — 404', function () {
    $seller = User::factory()->create();
    sellerListing($seller, ListingStatus::Published);
    $seller->forceFill(['blocked_at' => now()])->save();

    $this->get("/sellers/{$seller->id}")->assertNotFound();
    $this->get('/sellers/999999')->assertNotFound();
    $this->get('/sellers/abc')->assertNotFound();
    // Больше bigint: маршрут не совпадает, запрос в БД не уходит (на PostgreSQL был бы 500).
    $this->get('/sellers/99999999999999999999')->assertNotFound();
    $this->get('/sellers/0')->assertNotFound();
});

it('в props нет почты, yandex_id и телефона продавца (BR-04)', function () {
    $seller = User::factory()->create(['email' => 'seller.private@example.com', 'yandex_id' => 'ya-secret-1']);
    sellerListing($seller, ListingStatus::Published);

    $response = $this->get("/sellers/{$seller->id}")->assertOk();

    $props = json_encode($response->viewData('page')['props'], JSON_THROW_ON_ERROR);
    expect($props)->not->toContain('seller.private@example.com')
        ->and($props)->not->toContain('ya-secret-1')
        ->and($props)->not->toContain('"email"')
        ->and($props)->not->toContain('user_id')
        ->and($props)->not->toContain('phone');
});

it('страница лота даёт id продавца для ссылки на его страницу', function () {
    $listing = ListingFixtures::published();

    $this->get("/listings/{$listing->id}")->assertInertia(fn (Assert $page) => $page
        ->where('seller.id', $listing->user_id)
        ->etc());
});
