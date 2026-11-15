<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Favorites\Models\Favorite;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

// 4.3.1, UC-S5: вкладка «Избранное» кабинета. Снятое показывается как недоступное — без ссылки, фото и деталей
// (SPEC §6.1); снижение цены — old_price; чужое избранное не видно; обзор считает избранное.

beforeEach(function () {
    config(['scout.driver' => 'null']);
    Storage::fake(config('photos.disk'));
});

function saveFavorite(User $user, Listing $listing, ?int $savedPrice = null, ?string $createdAt = null): Favorite
{
    $favorite = Favorite::query()->create([
        'user_id' => $user->id,
        'listing_id' => $listing->id,
        'price_at_save' => $savedPrice ?? $listing->price,
    ]);
    if ($createdAt !== null) {
        $favorite->forceFill(['created_at' => $createdAt])->save();
    }

    return $favorite;
}

function favoritePhoto(Listing $listing): ListingPhoto
{
    $photo = ListingPhoto::query()->create(['listing_id' => $listing->id, 'path' => "photos/{$listing->id}/p1", 'position' => 1, 'is_serial' => false]);
    $photo->forceFill(['processed_at' => now(), 'phash' => '0123456789abcdef'])->save();

    return $photo;
}

it('гость уходит на главную', function () {
    $this->get('/account/favorites')->assertRedirect('/');
});

it('пустое избранное: пустой список', function () {
    $this->actingAs(User::factory()->create())->get('/account/favorites')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Account/Favorites')
            ->where('favorites', [])
            ->where('pagination', ['page' => 1, 'pages' => 1]));
});

it('карточки: поля из ListingCardResource, свежее добавленное первым, сердце включено', function () {
    $user = User::factory()->create();
    $old = Listing::factory()->inStatus(ListingStatus::Published)->create(['title' => 'Старое']);
    $new = Listing::factory()->inStatus(ListingStatus::Published)->create(['title' => 'Новое', 'price' => null]);
    saveFavorite($user, $old, createdAt: '2026-11-01 10:00:00');
    saveFavorite($user, $new, createdAt: '2026-11-02 10:00:00');

    $this->actingAs($user)->get('/account/favorites')->assertInertia(fn (Assert $page) => $page
        ->has('favorites', 2)
        ->where('favorites.0.id', $new->id)
        ->where('favorites.0.title', 'Новое')
        ->where('favorites.0.price', null)
        ->where('favorites.0.available', true)
        ->where('favorites.0.favorite', true)
        ->where('favorites.1.id', $old->id)
        ->where('favorites.1.old_price', null)
        ->etc());
});

it('снижение цены: old_price — цена при добавлении, если текущая ниже', function () {
    $user = User::factory()->create();
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['price' => 90_000]);
    saveFavorite($user, $listing, 120_000);

    $this->actingAs($user)->get('/account/favorites')->assertInertia(fn (Assert $page) => $page
        ->where('favorites.0.price', 90_000)
        ->where('favorites.0.old_price', 120_000)
        ->etc());
});

it('подорожание и «Бесплатно» подсветки не дают', function () {
    $user = User::factory()->create();
    $up = Listing::factory()->inStatus(ListingStatus::Published)->create(['price' => 150_000]);
    $free = Listing::factory()->inStatus(ListingStatus::Published)->create(['price' => 0]);
    saveFavorite($user, $up, 120_000, '2026-11-01 10:00:00');
    saveFavorite($user, $free, 5_000, '2026-11-02 10:00:00');

    $this->actingAs($user)->get('/account/favorites')->assertInertia(fn (Assert $page) => $page
        ->where('favorites.0.old_price', null)
        ->where('favorites.1.old_price', null)
        ->etc());
});

it('снятое с продажи: недоступно, только id, название и цена; фото и детали не уходят', function (ListingStatus $status) {
    $user = User::factory()->create();
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['title' => 'Снятая гитара', 'price' => 70_000, 'description' => 'Секретное описание']);
    favoritePhoto($listing);
    saveFavorite($user, $listing);
    $listing->forceFill(['status' => $status])->saveQuietly();

    $response = $this->actingAs($user)->get('/account/favorites')->assertInertia(fn (Assert $page) => $page
        ->where('favorites.0', ['id' => $listing->id, 'title' => 'Снятая гитара', 'price' => 70_000, 'available' => false, 'favorite' => true]));

    $props = json_encode($response->viewData('page')['props'], JSON_THROW_ON_ERROR);
    expect($props)->not->toContain('media\/photos')->and($props)->not->toContain('Секретное описание');
})->with([ListingStatus::Withdrawn, ListingStatus::Expired, ListingStatus::Rejected, ListingStatus::Pending]);

it('обложка доступного объявления — как в остальных карточках', function () {
    $user = User::factory()->create();
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create();
    $photo = favoritePhoto($listing);
    saveFavorite($user, $listing);

    $this->actingAs($user)->get('/account/favorites')->assertInertia(fn (Assert $page) => $page
        ->where('favorites.0.image', fn ($image) => str_contains((string) $image, "/media/photos/{$photo->id}/square.webp"))
        ->etc());
});

it('чужое избранное не видно', function () {
    saveFavorite(User::factory()->create(), Listing::factory()->inStatus(ListingStatus::Published)->create());

    $this->actingAs(User::factory()->create())->get('/account/favorites')->assertInertia(fn (Assert $page) => $page->where('favorites', []));
});

it('страницы по 24: pagination и ?page', function () {
    $user = User::factory()->create();
    Listing::factory()->count(25)->inStatus(ListingStatus::Published)->create()
        ->each(fn (Listing $listing) => saveFavorite($user, $listing));

    $this->actingAs($user)->get('/account/favorites')->assertInertia(fn (Assert $page) => $page
        ->has('favorites', 24)->where('pagination', ['page' => 1, 'pages' => 2]));
    $this->actingAs($user)->get('/account/favorites?page=2')->assertInertia(fn (Assert $page) => $page
        ->has('favorites', 1)->where('pagination', ['page' => 2, 'pages' => 2]));
});

it('обзор: число избранного в блоке «Покупаю», снятые тоже считаются', function () {
    $user = User::factory()->create();
    saveFavorite($user, Listing::factory()->inStatus(ListingStatus::Published)->create());
    $gone = Listing::factory()->inStatus(ListingStatus::Published)->create();
    saveFavorite($user, $gone);
    $gone->forceFill(['status' => ListingStatus::Withdrawn])->saveQuietly();

    $this->actingAs($user)->get('/account')->assertInertia(fn (Assert $page) => $page->where('buying.favorites', 2)->etc());
});
