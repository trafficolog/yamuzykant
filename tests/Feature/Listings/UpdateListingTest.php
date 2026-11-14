<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Events\ListingPriceDropped;
use App\Domain\Listings\Models\ListingPriceChange;
use App\Support\Flags\FeatureFlag;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Pennant\Feature;
use Tests\Support\MyListingFixtures;

// UC-L3 (2.1.5): изменить объявление той же формой, снизить цену окном; цена — без повторной модерации, с историей.

beforeEach(function () {
    config(['scout.driver' => 'null']);
    Feature::for(null)->deactivate(FeatureFlag::Premoderation->value);
});

it('страница изменения: та же форма с содержимым объявления; серийный номер — маской', function () {
    $owner = User::factory()->create();
    $listing = MyListingFixtures::listing($owner);

    $this->actingAs($owner)->get("/listings/{$listing->id}/edit")->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Sell/Create')
            ->where('mode', 'edit')
            ->where('listingId', $listing->id)
            ->has('photos', 3)
            ->where('draft.title', 'Fender American Vintage ’57 Stratocaster')
            ->where('draft.price', 184_500)
            ->where('draft.price_mode', 'amount')
            ->where('draft.serial_masked', 'V09****'));
});

it('изменять можно только своё опубликованное объявление', function () {
    $owner = User::factory()->create();
    $published = MyListingFixtures::listing($owner);
    $pending = MyListingFixtures::listing($owner, ListingStatus::Pending);

    $this->actingAs(User::factory()->create())->get("/listings/{$published->id}/edit")->assertForbidden();
    $this->actingAs($owner)->get("/listings/{$pending->id}/edit")->assertForbidden();
    $this->actingAs(User::factory()->create())->put("/listings/{$published->id}", MyListingFixtures::form($published))->assertForbidden();
    $this->actingAs($owner)->put("/listings/{$pending->id}", MyListingFixtures::form($pending))->assertForbidden();
    $this->put("/listings/{$published->id}", [])->assertRedirect('/');
});

it('рост цены — без модерации, статус published, запись в историю цен', function () {
    Feature::for(null)->activate(FeatureFlag::Premoderation->value);
    $owner = User::factory()->create();
    $listing = MyListingFixtures::listing($owner);

    $this->actingAs($owner)->put("/listings/{$listing->id}", MyListingFixtures::form($listing, ['price' => 200_000]))
        ->assertSessionHasNoErrors()->assertRedirect('/account/listings');

    $listing->refresh();
    $change = ListingPriceChange::query()->sole();
    expect($listing->status)->toBe(ListingStatus::Published)->and($listing->price)->toBe(200_000)
        ->and($change->old_price)->toBe(184_500)->and($change->new_price)->toBe(200_000);
});

it('снижение цены той же формой — без модерации, событие снижения, запись в историю', function () {
    Feature::for(null)->activate(FeatureFlag::Premoderation->value);
    Event::fake([ListingPriceDropped::class]);
    $owner = User::factory()->create();
    $listing = MyListingFixtures::listing($owner);

    $this->actingAs($owner)->put("/listings/{$listing->id}", MyListingFixtures::form($listing, ['price' => 170_000]))->assertSessionHasNoErrors();

    expect($listing->fresh()?->status)->toBe(ListingStatus::Published)->and(ListingPriceChange::query()->count())->toBe(1);
    Event::assertDispatched(ListingPriceDropped::class);
});

it('правка без изменения цены историю не пишет', function () {
    $owner = User::factory()->create();
    $listing = MyListingFixtures::listing($owner);

    $this->actingAs($owner)->put("/listings/{$listing->id}", MyListingFixtures::form($listing, ['year' => 1960]))->assertSessionHasNoErrors();

    expect($listing->fresh()?->year)->toBe(1960)->and(ListingPriceChange::query()->count())->toBe(0);
});

it('существенная правка (название): премодерация включена — pending, выключена — published', function (bool $premoderation, ListingStatus $expected) {
    $premoderation ? Feature::for(null)->activate(FeatureFlag::Premoderation->value) : null;
    $owner = User::factory()->create();
    $listing = MyListingFixtures::listing($owner);

    $this->actingAs($owner)->put("/listings/{$listing->id}", MyListingFixtures::form($listing, ['title' => 'Gibson Les Paul Standard']))
        ->assertSessionHasNoErrors();

    expect($listing->fresh()?->status)->toBe($expected)->and($listing->fresh()?->title)->toBe('Gibson Les Paul Standard');
})->with([[true, ListingStatus::Pending], [false, ListingStatus::Published]]);

it('изменение фото — существенная правка', function () {
    Feature::for(null)->activate(FeatureFlag::Premoderation->value);
    $owner = User::factory()->create();
    $listing = MyListingFixtures::listing($owner);

    $this->actingAs($owner)->put("/listings/{$listing->id}", MyListingFixtures::form($listing, ['photos_changed' => true]))->assertSessionHasNoErrors();

    expect($listing->fresh()?->status)->toBe(ListingStatus::Pending);
});

it('серийный номер без ключа не меняется, с ключом — заменяется', function () {
    $owner = User::factory()->create();
    $listing = MyListingFixtures::listing($owner);

    $this->actingAs($owner)->put("/listings/{$listing->id}", MyListingFixtures::form($listing))->assertSessionHasNoErrors();
    expect($listing->fresh()?->serialMasked())->toBe('V09****');

    $this->actingAs($owner)->put("/listings/{$listing->id}", MyListingFixtures::form($listing, ['serial' => 'ZZ99887']))->assertSessionHasNoErrors();
    expect($listing->fresh()?->serialMasked())->toBe('ZZ9****');
});

it('те же правила, что у публикации: контакты в описании и цена по BR-11', function () {
    $owner = User::factory()->create();
    $listing = MyListingFixtures::listing($owner);

    $this->actingAs($owner)->put("/listings/{$listing->id}", MyListingFixtures::form($listing, ['description' => 'Звоните +7 912 345-67-89']))
        ->assertSessionHasErrors('description');
    $this->actingAs($owner)->put("/listings/{$listing->id}", MyListingFixtures::form($listing, ['price_mode' => 'amount', 'price' => 0]))
        ->assertSessionHasErrors('price');

    $this->actingAs($owner)->put("/listings/{$listing->id}", MyListingFixtures::form($listing, ['price_mode' => 'free', 'price' => null, 'negotiable' => true]))
        ->assertSessionHasNoErrors();
    $listing->refresh();
    expect($listing->price)->toBe(0)->and($listing->negotiable)->toBeFalse();
});

it('окно «Снизить цену»: цена ниже текущей — снижение без модерации и запись в историю', function () {
    Feature::for(null)->activate(FeatureFlag::Premoderation->value);
    $owner = User::factory()->create();
    $listing = MyListingFixtures::listing($owner);

    $this->actingAs($owner)->patch("/listings/{$listing->id}/price", ['price' => 170_000])->assertSessionHasNoErrors();

    $listing->refresh();
    expect($listing->status)->toBe(ListingStatus::Published)->and($listing->price)->toBe(170_000)
        ->and(ListingPriceChange::query()->sole()->new_price)->toBe(170_000);
});

it('окно «Снизить цену»: не ниже текущей, не больше нуля, чужое и не опубликованное — отказ', function () {
    $owner = User::factory()->create();
    $listing = MyListingFixtures::listing($owner);
    $pending = MyListingFixtures::listing($owner, ListingStatus::Pending);

    $this->actingAs($owner)->patch("/listings/{$listing->id}/price", ['price' => 184_500])->assertSessionHasErrors('price');
    $this->actingAs($owner)->patch("/listings/{$listing->id}/price", ['price' => 200_000])->assertSessionHasErrors('price');
    $this->actingAs($owner)->patch("/listings/{$listing->id}/price", ['price' => 0])->assertSessionHasErrors('price');
    $this->actingAs(User::factory()->create())->patch("/listings/{$listing->id}/price", ['price' => 1000])->assertForbidden();
    $this->actingAs($owner)->patch("/listings/{$pending->id}/price", ['price' => 1000])->assertForbidden();

    expect($listing->fresh()?->price)->toBe(184_500);
});
