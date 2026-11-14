<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\Models\SaleRecord;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\MessagingFixtures;
use Tests\Support\MyListingFixtures;

// UC-L3, UC-L4 (2.1.5): вкладка «Объявления» кабинета — фильтр по статусам, статус, причина возврата, счётчики.

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('гостя отправляет на главную', function () {
    $this->get('/account/listings')->assertRedirect('/');
});

it('показывает только свои объявления, черновики не входят', function () {
    $me = User::factory()->create();
    MyListingFixtures::listing($me);
    MyListingFixtures::listing($me, ListingStatus::Draft);
    MyListingFixtures::listing(User::factory()->create());

    $this->actingAs($me)->get('/account/listings')->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Account/Listings')
            ->has('listings', 1)
            ->where('listings.0.status', 'published')
            ->where('listings.0.price', 184_500)
            ->where('filter', 'all'));
});

it('фильтр по статусам и счётчики по фильтрам', function () {
    $me = User::factory()->create();
    MyListingFixtures::listing($me, ListingStatus::Published);
    MyListingFixtures::listing($me, ListingStatus::Pending);
    MyListingFixtures::listing($me, ListingStatus::NeedsChanges);
    MyListingFixtures::listing($me, ListingStatus::Withdrawn);
    MyListingFixtures::listing($me, ListingStatus::Expired);

    $this->actingAs($me)->get('/account/listings?status=review')
        ->assertInertia(fn (Assert $page) => $page
            ->has('listings', 2)
            ->where('filter', 'review')
            ->where('counts', ['all' => 5, 'published' => 1, 'review' => 2, 'closed' => 2]));

    $this->actingAs($me)->get('/account/listings?status=closed')->assertInertia(fn (Assert $page) => $page->has('listings', 2));
    $this->actingAs($me)->get('/account/listings?status=nonsense')->assertInertia(fn (Assert $page) => $page
        ->has('listings', 5)->where('filter', 'all'));
});

it('у возвращённого на доработку — причина модератора дословно', function () {
    $me = User::factory()->create();
    $listing = MyListingFixtures::listing($me, ListingStatus::Pending);
    app(ListingStateMachine::class)->returnForChanges($listing, 'Добавьте фото грифа крупным планом.');

    $this->actingAs($me)->get('/account/listings')->assertInertia(fn (Assert $page) => $page
        ->where('listings.0.status', 'needs_changes')
        ->where('listings.0.return_reason', 'Добавьте фото грифа крупным планом.'));
});

it('счётчики: беседы по объявлению и просмотры; обложка — не фото серийного номера', function () {
    $me = User::factory()->create();
    $listing = MyListingFixtures::listing($me);
    MessagingFixtures::conversation($listing);
    MessagingFixtures::conversation($listing);
    $listing->forceFill(['views_count' => 41])->save();
    $coverId = $listing->photos()->where('is_serial', false)->orderBy('position')->firstOrFail()->id;

    $this->actingAs($me)->get('/account/listings')->assertInertia(fn (Assert $page) => $page
        ->where('listings.0.chats', 2)
        ->where('listings.0.views', 41)
        ->where('listings.0.cover.square.webp', fn (string $url) => str_contains($url, "/media/photos/{$coverId}/")));
});

it('итоговая цена продажи на фронт не уходит', function () {
    $me = User::factory()->create();
    $listing = MyListingFixtures::listing($me);
    app(ListingStateMachine::class)->withdraw($listing, WithdrawReason::SoldHere, 170_000);
    expect(SaleRecord::query()->count())->toBe(1);

    $content = (string) $this->actingAs($me)->get('/account/listings')->assertOk()->getContent();
    expect($content)->not->toContain('170000')->and($content)->not->toContain('final_price');
});

it('просмотр страницы объявления гостем увеличивает счётчик, владельцем — нет', function () {
    $owner = User::factory()->create();
    $listing = MyListingFixtures::listing($owner);

    $this->get("/listings/{$listing->id}")->assertOk();
    $this->get("/listings/{$listing->id}")->assertOk();
    $this->actingAs($owner)->get("/listings/{$listing->id}")->assertOk();

    expect($listing->fresh()?->views_count)->toBe(2);
});
