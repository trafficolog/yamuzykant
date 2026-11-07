<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Accounts\Staff\StaffDirectory;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\ListingFixtures;
use Tests\Support\MeilisearchIndex;

// 3.1.5, UC-V1 / UC-D1: страница объявления `/listings/{id}`. Данные наружу — явным списком полей (BR-04, AGENTS §4);
// не опубликованное видят владелец и сотрудники, остальным 404 (решение OWNER 07.11.2026, SPEC §6.1);
// цена по BR-11. Meilisearch — настоящий (блок «Похожие»).

beforeEach(function () {
    MeilisearchIndex::resetListings();
    Storage::fake(config('photos.disk'));
});

function lotPhoto(Listing $listing, int $position, bool $serial = false): ListingPhoto
{
    $photo = ListingPhoto::query()->create([
        'listing_id' => $listing->id,
        'path' => "photos/{$listing->id}/p{$position}",
        'position' => $position,
        'is_serial' => $serial,
    ]);
    $photo->forceFill(['processed_at' => now(), 'phash' => '0123456789abcdef'])->save();

    return $photo;
}

function lotStaff(User $staff): void
{
    app()->instance(StaffDirectory::class, new class($staff) implements StaffDirectory
    {
        public function __construct(private readonly User $staff) {}

        public function isStaff(User $user): bool
        {
            return $user->is($this->staff);
        }
    });
}

it('отдаёт опубликованное объявление гостю: Inertia-страница Lot/Show с полями лота', function () {
    $listing = ListingFixtures::published();

    $this->get("/listings/{$listing->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Lot/Show')
            ->where('listing.id', $listing->id)
            ->where('listing.title', 'Fender ’57 Stratocaster')
            ->where('listing.price', 184_500)
            ->where('listing.negotiable', true)
            ->where('listing.condition.value', 'excellent')
            ->where('listing.condition.label', 'Отличное')
            ->where('listing.year', 1957)
            ->where('listing.brand', 'Fender')
            ->where('listing.ship', false)
            ->where('listing.meet', true)
            ->where('listing.status', 'published')
            ->where('crumbs.0.name', 'Гитары')
            ->where('crumbs.1.name', 'Электрогитары')
            ->where('viewer.is_owner', false)
            ->where('viewer.authenticated', false)
            ->etc());
});

it('в props нет почты продавца, полного серийного номера и расстояния; серийный номер замаскирован', function () {
    $listing = ListingFixtures::published();
    $seller = $listing->user;
    $seller->forceFill(['email' => 'seller.private@example.com'])->save();

    $response = $this->get("/listings/{$listing->id}")->assertOk();
    $response->assertInertia(fn (Assert $page) => $page
        ->where('listing.serial', 'V09****')
        ->where('seller.name', $seller->name)
        ->has('seller', fn (Assert $s) => $s->hasAll(['name', 'city', 'since']))
        ->etc());

    $props = json_encode($response->viewData('page')['props'], JSON_THROW_ON_ERROR);
    expect($props)->not->toContain('seller.private@example.com')
        ->and($props)->not->toContain('V091234')
        ->and($props)->not->toContain('serial_enc')
        ->and($props)->not->toContain('distance')
        ->and($props)->not->toContain('"email"')
        ->and($props)->not->toContain('phone');
});

it('цена по BR-11: сумма, null — «Договорная», 0 — «Бесплатно»; «Готов к торгу» только при сумме', function (?int $price, bool $negotiable, bool $expected) {
    $listing = ListingFixtures::published(['price' => $price, 'negotiable' => $negotiable]);

    $this->get("/listings/{$listing->id}")->assertInertia(fn (Assert $page) => $page
        ->where('listing.price', $price)
        ->where('listing.negotiable', $expected)
        ->etc());
})->with([
    'сумма и торг' => [184_500, true, true],
    'сумма без торга' => [184_500, false, false],
    'договорная' => [null, true, false],
    'бесплатно' => [0, true, false],
]);

it('не опубликованное: гостю и чужому пользователю 404, владельцу и сотруднику 200', function (ListingStatus $status) {
    $listing = ListingFixtures::published();
    $staff = User::factory()->create();
    lotStaff($staff);
    $listing->forceFill(['status' => $status])->saveQuietly();

    $this->get("/listings/{$listing->id}")->assertNotFound();
    $this->actingAs(User::factory()->create())->get("/listings/{$listing->id}")->assertNotFound();
    $this->actingAs($listing->user)->get("/listings/{$listing->id}")->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('listing.status', $status->value)->where('viewer.is_owner', true)->etc());
    $this->actingAs($staff)->get("/listings/{$listing->id}")->assertOk();
})->with([
    'withdrawn' => [ListingStatus::Withdrawn],
    'expired' => [ListingStatus::Expired],
    'pending' => [ListingStatus::Pending],
    'needs_changes' => [ListingStatus::NeedsChanges],
    'rejected' => [ListingStatus::Rejected],
    'draft' => [ListingStatus::Draft],
]);

it('снятое владельцу: 200, признак «продано» и блок похожих; итоговая цена наружу не уходит', function () {
    $listing = ListingFixtures::published();
    app(ListingStateMachine::class)->withdraw($listing, WithdrawReason::SoldHere, 150_000);

    $response = $this->actingAs($listing->user)->get("/listings/{$listing->id}")->assertOk();
    $response->assertInertia(fn (Assert $page) => $page
        ->where('listing.status', 'withdrawn')
        ->where('listing.sold', true)
        ->has('similar')
        ->etc());

    expect(json_encode($response->viewData('page')['props'], JSON_THROW_ON_ERROR))->not->toContain('150000');
});

it('снято не по продаже: sold = false', function () {
    $listing = ListingFixtures::published();
    app(ListingStateMachine::class)->withdraw($listing, WithdrawReason::ChangedMind);

    $this->actingAs($listing->user)->get("/listings/{$listing->id}")
        ->assertInertia(fn (Assert $page) => $page->where('listing.sold', false)->etc());
});

it('несуществующее объявление и не-UUID — 404', function () {
    $this->get('/listings/'.Str::uuid())->assertNotFound();
    $this->get('/listings/not-a-uuid')->assertNotFound();
});

it('фото: гостю — готовые фото без серийного, владельцу — и фото серийного номера', function () {
    $listing = ListingFixtures::published();
    $first = lotPhoto($listing, 0);
    lotPhoto($listing, 1, serial: true);
    ListingPhoto::query()->create(['listing_id' => $listing->id, 'path' => 'photos/x/pending', 'position' => 2]);

    $this->get("/listings/{$listing->id}")->assertInertia(fn (Assert $page) => $page
        ->has('photos', 1)
        ->where('photos.0.id', $first->id)
        ->where('photos.0.urls.wide.webp', fn (string $url) => str_contains($url, "/media/photos/{$first->id}/wide.webp"))
        ->etc());

    $this->actingAs($listing->user)->get("/listings/{$listing->id}")->assertInertia(fn (Assert $page) => $page
        ->has('photos', 2)
        ->where('photos.1.is_serial', true)
        ->etc());
});

it('фото серийного номера не раздаётся чужому и гостю', function () {
    $listing = ListingFixtures::published();
    $serial = lotPhoto($listing, 0, serial: true);

    $this->get("/media/photos/{$serial->id}/wide.webp")->assertNotFound();
    $this->actingAs(User::factory()->create())->get("/media/photos/{$serial->id}/wide.webp")->assertNotFound();
});

it('вошедший: viewer.authenticated, владелец — is_owner', function () {
    $listing = ListingFixtures::published();

    $this->actingAs(User::factory()->create())->get("/listings/{$listing->id}")
        ->assertInertia(fn (Assert $page) => $page->where('viewer.authenticated', true)->where('viewer.is_owner', false)->etc());
    $this->actingAs($listing->user)->get("/listings/{$listing->id}")
        ->assertInertia(fn (Assert $page) => $page->where('viewer.is_owner', true)->etc());
});

it('похожие: опубликованные из того же города и категории, без самого объявления, без снятых и чужих городов', function () {
    $moscow = ListingFixtures::city('Москва');
    $kazan = ListingFixtures::city('Казань');
    $listing = ListingFixtures::published(['title' => 'Основной лот'], $moscow);
    $similar = ListingFixtures::published(['title' => 'Похожий лот', 'price' => 78_000], $moscow);
    $withdrawn = ListingFixtures::published(['title' => 'Снятый лот'], $moscow);
    app(ListingStateMachine::class)->withdraw($withdrawn, WithdrawReason::ChangedMind);
    ListingFixtures::published(['title' => 'Лот из Казани'], $kazan);
    ListingFixtures::published(['title' => 'Педаль'], $moscow, ListingFixtures::pedals());
    MeilisearchIndex::waitForTasks();

    $this->get("/listings/{$listing->id}")->assertInertia(fn (Assert $page) => $page
        ->has('similar', 1)
        ->where('similar.0.id', $similar->id)
        ->where('similar.0.price', 78_000)
        ->where('similar.0.city', 'Москва')
        ->missing('similar.0.distance')
        ->missing('similar.0.user_id')
        ->etc());
});

it('похожих не больше пяти', function () {
    $city = ListingFixtures::city('Москва');
    $listing = ListingFixtures::published([], $city);
    foreach (range(1, 7) as $i) {
        ListingFixtures::published(['title' => "Гитара {$i}"], $city);
    }
    MeilisearchIndex::waitForTasks();

    $this->get("/listings/{$listing->id}")->assertInertia(fn (Assert $page) => $page->has('similar', 5)->etc());
});

it('недоступный поиск не роняет страницу: похожие пусты', function () {
    $listing = ListingFixtures::published();
    config(['scout.meilisearch.host' => 'http://127.0.0.1:1']);

    $this->get("/listings/{$listing->id}")->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('similar', 0)->etc());
});

it('без города страница открывается, похожих нет', function () {
    $listing = ListingFixtures::published();
    $listing->forceFill(['city_id' => null])->saveQuietly();

    $this->get("/listings/{$listing->id}")->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('listing.city', null)->has('similar', 0)->etc());
});
