<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Favorites\Models\Favorite;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\MeilisearchIndex;

// 4.3.1: сердце на странице лота и на карточках продавца знает, в избранном ли объявление у зрителя.
// Карточки Барахолки — FleaListingResourceTest и FleaFavoritesTest.

beforeEach(function () {
    MeilisearchIndex::resetListings();
});

it('лот: viewer.favorite — у гостя false, у вошедшего по его избранному', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create();
    $user = User::factory()->create();

    $this->get("/listings/{$listing->id}")->assertInertia(fn (Assert $page) => $page->where('viewer.favorite', false)->etc());
    $this->actingAs($user)->get("/listings/{$listing->id}")->assertInertia(fn (Assert $page) => $page->where('viewer.favorite', false)->etc());

    Favorite::query()->create(['user_id' => $user->id, 'listing_id' => $listing->id, 'price_at_save' => $listing->price]);

    $this->actingAs($user)->get("/listings/{$listing->id}")->assertInertia(fn (Assert $page) => $page->where('viewer.favorite', true)->etc());
    $this->actingAs(User::factory()->create())->get("/listings/{$listing->id}")->assertInertia(fn (Assert $page) => $page->where('viewer.favorite', false)->etc());
});

it('страница продавца: у карточек favorite по избранному зрителя', function () {
    $seller = User::factory()->create();
    // Свежие первыми: избранное опубликовано позже.
    $mine = Listing::factory()->inStatus(ListingStatus::Published)->for($seller)->create(['title' => 'В избранном', 'published_at' => now()->subDay()]);
    Listing::factory()->inStatus(ListingStatus::Published)->for($seller)->create(['title' => 'Не в избранном', 'published_at' => now()->subDays(2)]);
    $viewer = User::factory()->create();
    Favorite::query()->create(['user_id' => $viewer->id, 'listing_id' => $mine->id, 'price_at_save' => $mine->price]);

    // Гость — до actingAs: вошедший пользователь остаётся в тесте для следующих запросов.
    $this->get("/sellers/{$seller->id}")->assertInertia(fn (Assert $page) => $page
        ->where('listings.0.favorite', false)
        ->where('listings.1.favorite', false)
        ->etc());
    $this->actingAs($viewer)->get("/sellers/{$seller->id}")->assertInertia(fn (Assert $page) => $page
        ->where('listings.0.title', 'В избранном')
        ->where('listings.0.favorite', true)
        ->where('listings.1.favorite', false)
        ->etc());
});
