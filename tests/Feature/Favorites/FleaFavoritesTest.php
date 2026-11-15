<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Favorites\Models\Favorite;
use Database\Seeders\CitySeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\ListingFixtures;
use Tests\Support\MeilisearchIndex;

// 4.3.1: у карточек Барахолки — favorite по избранному зрителя (гость — всегда false). Meilisearch настоящий.

beforeEach(function () {
    $this->seed(CitySeeder::class);
    MeilisearchIndex::resetListings();
});

it('Барахолка: favorite у карточек вошедшего зрителя', function () {
    $moscow = App\Domain\Catalog\Models\City::query()->where('name', 'Москва')->firstOrFail();
    $liked = ListingFixtures::published(['title' => 'В избранном'], $moscow);
    ListingFixtures::published(['title' => 'Не в избранном'], $moscow);
    $viewer = User::factory()->create();
    Favorite::query()->create(['user_id' => $viewer->id, 'listing_id' => $liked->id, 'price_at_save' => $liked->price]);
    MeilisearchIndex::waitForTasks();

    $this->actingAs($viewer)->get('/baraholka')->assertInertia(fn (Assert $page) => $page
        ->where('listings', fn ($cards) => collect($cards)->pluck('favorite', 'title')->all() === ['В избранном' => true, 'Не в избранном' => false])
        ->etc());
    $this->get('/baraholka')->assertInertia(fn (Assert $page) => $page
        ->where('listings', fn ($cards) => collect($cards)->every(fn ($card) => $card['favorite'] === false))
        ->etc());
});
