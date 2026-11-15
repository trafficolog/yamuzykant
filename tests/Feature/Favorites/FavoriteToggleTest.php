<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Favorites\Models\Favorite;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;

// 4.3.1, UC-S5: «В избранное» — PUT/DELETE /listings/{id}/favorite. PUT выставляет состояние (идемпотентно),
// чтобы повтор после входа гостя не снял сердце; добавить можно только опубликованное (SPEC §6.1).

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

/** @param  array<string, mixed>  $attributes */
function publishedListing(array $attributes = []): Listing
{
    return Listing::factory()->inStatus(ListingStatus::Published)->create($attributes);
}

it('таблица favorites: пара «пользователь — объявление» уникальна', function () {
    expect(Schema::hasTable('favorites'))->toBeTrue()
        ->and(Schema::hasColumns('favorites', ['user_id', 'listing_id', 'price_at_save', 'created_at']))->toBeTrue();

    $user = User::factory()->create();
    $listing = publishedListing();
    Favorite::query()->create(['user_id' => $user->id, 'listing_id' => $listing->id, 'price_at_save' => 100]);

    expect(fn () => Favorite::query()->create(['user_id' => $user->id, 'listing_id' => $listing->id, 'price_at_save' => 100]))
        ->toThrow(QueryException::class);
});

it('гость получает 401, в избранное ничего не попадает', function () {
    $listing = publishedListing();

    $this->putJson("/listings/{$listing->id}/favorite")->assertUnauthorized();
    $this->deleteJson("/listings/{$listing->id}/favorite")->assertUnauthorized();

    expect(Favorite::query()->count())->toBe(0);
});

it('PUT добавляет объявление и запоминает цену на момент добавления', function () {
    $user = User::factory()->create();
    $listing = publishedListing(['price' => 120_000]);

    $this->actingAs($user)->putJson("/listings/{$listing->id}/favorite")
        ->assertOk()
        ->assertExactJson(['favorite' => true]);

    $favorite = Favorite::query()->where('user_id', $user->id)->sole();
    expect($favorite->listing_id)->toBe($listing->id)->and($favorite->price_at_save)->toBe(120_000);
});

it('повторный PUT идемпотентен и цену не перезаписывает', function () {
    $user = User::factory()->create();
    $listing = publishedListing(['price' => 120_000]);
    $this->actingAs($user)->putJson("/listings/{$listing->id}/favorite")->assertOk();
    $listing->forceFill(['price' => 100_000])->saveQuietly();

    $this->actingAs($user)->putJson("/listings/{$listing->id}/favorite")->assertOk()->assertExactJson(['favorite' => true]);

    expect(Favorite::query()->count())->toBe(1)
        ->and(Favorite::query()->sole()->price_at_save)->toBe(120_000);
});

it('цена «Договорная» и «Бесплатно» сохраняется как есть', function (?int $price) {
    $user = User::factory()->create();
    $listing = publishedListing(['price' => $price]);

    $this->actingAs($user)->putJson("/listings/{$listing->id}/favorite")->assertOk();

    expect(Favorite::query()->sole()->price_at_save)->toBe($price);
})->with(['договорная' => [null], 'бесплатно' => [0]]);

it('DELETE снимает отметку и идемпотентен', function () {
    $user = User::factory()->create();
    $listing = publishedListing();
    $this->actingAs($user)->putJson("/listings/{$listing->id}/favorite");

    $this->actingAs($user)->deleteJson("/listings/{$listing->id}/favorite")->assertOk()->assertExactJson(['favorite' => false]);
    $this->actingAs($user)->deleteJson("/listings/{$listing->id}/favorite")->assertOk()->assertExactJson(['favorite' => false]);

    expect(Favorite::query()->count())->toBe(0);
});

it('чужое избранное не трогается', function () {
    $listing = publishedListing();
    $other = User::factory()->create();
    Favorite::query()->create(['user_id' => $other->id, 'listing_id' => $listing->id, 'price_at_save' => 1]);

    $this->actingAs(User::factory()->create())->deleteJson("/listings/{$listing->id}/favorite")->assertOk();

    expect(Favorite::query()->where('user_id', $other->id)->count())->toBe(1);
});

it('не опубликованное в избранное не добавить: 404', function (ListingStatus $status) {
    $listing = Listing::factory()->inStatus($status)->create();

    $this->actingAs(User::factory()->create())->putJson("/listings/{$listing->id}/favorite")->assertNotFound();

    expect(Favorite::query()->count())->toBe(0);
})->with(['черновик' => [ListingStatus::Draft], 'на проверке' => [ListingStatus::Pending], 'снято' => [ListingStatus::Withdrawn], 'истекло' => [ListingStatus::Expired], 'отклонено' => [ListingStatus::Rejected]]);

it('снятое с публикации из избранного убрать можно', function () {
    $user = User::factory()->create();
    $listing = publishedListing();
    $this->actingAs($user)->putJson("/listings/{$listing->id}/favorite");
    $listing->forceFill(['status' => ListingStatus::Withdrawn])->saveQuietly();

    $this->actingAs($user)->deleteJson("/listings/{$listing->id}/favorite")->assertOk();

    expect(Favorite::query()->count())->toBe(0);
});

it('несуществующее объявление и не uuid — 404', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->putJson('/listings/'.fake()->uuid().'/favorite')->assertNotFound();
    $this->actingAs($user)->putJson('/listings/not-a-uuid/favorite')->assertNotFound();
});

it('переключение не чаще 60 раз в минуту', function () {
    $user = User::factory()->create();
    $listing = publishedListing();

    foreach (range(1, 60) as $_) {
        $this->actingAs($user)->putJson("/listings/{$listing->id}/favorite")->assertOk();
    }

    $this->actingAs($user)->putJson("/listings/{$listing->id}/favorite")->assertStatus(429);
});

it('удаление пользователя убирает и записи избранного', function () {
    $user = User::factory()->create();
    $listing = publishedListing();
    $this->actingAs($user)->putJson("/listings/{$listing->id}/favorite");

    $user->delete();

    expect(Favorite::query()->count())->toBe(0);
});
