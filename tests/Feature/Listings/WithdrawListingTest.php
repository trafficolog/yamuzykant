<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\Models\SaleRecord;
use Tests\Support\MyListingFixtures;

// UC-L4 (2.1.5): снять с продажи с причиной и итоговой ценой; вернуть в продажу; продлить истёкшее.

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('«Продал на ЯМузыканте» с суммой создаёт sale_record; публично сумма не видна', function () {
    $owner = User::factory()->create();
    $listing = MyListingFixtures::listing($owner);

    $this->actingAs($owner)->post("/listings/{$listing->id}/withdraw", ['reason' => 'sold_here', 'final_price' => 170_000])
        ->assertSessionHasNoErrors();

    $record = SaleRecord::query()->sole();
    expect($listing->fresh()?->status)->toBe(ListingStatus::Withdrawn)
        ->and($record->reason)->toBe(WithdrawReason::SoldHere)
        ->and($record->final_price)->toBe(170_000)
        ->and($record->toArray())->not->toHaveKey('final_price');

    $this->actingAs(User::factory()->create())->get("/listings/{$listing->id}")->assertNotFound();
});

it('«Продал в другом месте» без суммы: запись без итоговой цены', function () {
    $owner = User::factory()->create();
    $listing = MyListingFixtures::listing($owner);

    $this->actingAs($owner)->post("/listings/{$listing->id}/withdraw", ['reason' => 'sold_elsewhere'])->assertSessionHasNoErrors();

    expect(SaleRecord::query()->sole()->final_price)->toBeNull()
        ->and($listing->fresh()?->status)->toBe(ListingStatus::Withdrawn);
});

it('«Передумал» с суммой — ошибка, объявление не тронуто', function () {
    $owner = User::factory()->create();
    $listing = MyListingFixtures::listing($owner);

    $this->actingAs($owner)->post("/listings/{$listing->id}/withdraw", ['reason' => 'changed_mind', 'final_price' => 1000])
        ->assertSessionHasErrors('final_price');

    expect($listing->fresh()?->status)->toBe(ListingStatus::Published)->and(SaleRecord::query()->count())->toBe(0);
});

it('причина обязательна и берётся из списка продавца: «moderation» выбрать нельзя', function () {
    $owner = User::factory()->create();
    $listing = MyListingFixtures::listing($owner);

    $this->actingAs($owner)->post("/listings/{$listing->id}/withdraw", [])->assertSessionHasErrors('reason');
    $this->actingAs($owner)->post("/listings/{$listing->id}/withdraw", ['reason' => 'moderation'])->assertSessionHasErrors('reason');
    $this->actingAs($owner)->post("/listings/{$listing->id}/withdraw", ['reason' => 'sold_here', 'final_price' => 0])->assertSessionHasErrors('final_price');
});

it('объявление на проверке: «Продал на ЯМузыканте» — ошибка, «Передумал» — снимает', function () {
    $owner = User::factory()->create();
    $listing = MyListingFixtures::listing($owner, ListingStatus::Pending);

    $this->actingAs($owner)->post("/listings/{$listing->id}/withdraw", ['reason' => 'sold_here'])->assertSessionHasErrors('reason');
    expect($listing->fresh()?->status)->toBe(ListingStatus::Pending);

    $this->actingAs($owner)->post("/listings/{$listing->id}/withdraw", ['reason' => 'changed_mind'])->assertSessionHasNoErrors();
    expect($listing->fresh()?->status)->toBe(ListingStatus::Withdrawn);
});

it('чужое объявление снять нельзя; уже снятое — нельзя повторно', function () {
    $owner = User::factory()->create();
    $listing = MyListingFixtures::listing($owner);

    $this->actingAs(User::factory()->create())->post("/listings/{$listing->id}/withdraw", ['reason' => 'changed_mind'])->assertNotFound();
    $this->actingAs($owner)->post("/listings/{$listing->id}/withdraw", ['reason' => 'changed_mind']);
    $this->actingAs($owner)->post("/listings/{$listing->id}/withdraw", ['reason' => 'changed_mind'])->assertForbidden();
});

it('вернуть в продажу: published, запись о продаже удалена', function () {
    $owner = User::factory()->create();
    $listing = MyListingFixtures::listing($owner);
    $this->actingAs($owner)->post("/listings/{$listing->id}/withdraw", ['reason' => 'sold_here', 'final_price' => 170_000]);

    $this->actingAs($owner)->post("/listings/{$listing->id}/relist")->assertSessionHasNoErrors();

    expect($listing->fresh()?->status)->toBe(ListingStatus::Published)->and(SaleRecord::query()->count())->toBe(0);
});

it('продлить истёкшее: published', function () {
    $owner = User::factory()->create();
    $listing = MyListingFixtures::listing($owner, ListingStatus::Expired);

    $this->actingAs($owner)->post("/listings/{$listing->id}/renew")->assertSessionHasNoErrors();

    expect($listing->fresh()?->status)->toBe(ListingStatus::Published);
});

it('лимит BR-06 при возврате и продлении — понятный отказ в поле limit, статус прежний', function (string $action, ListingStatus $status) {
    config(['listings.active_limit' => 1]);
    $owner = User::factory()->create();
    MyListingFixtures::listing($owner);
    $listing = MyListingFixtures::listing($owner, $status);

    $this->actingAs($owner)->post("/listings/{$listing->id}/{$action}")
        ->assertSessionHasErrors(['limit' => 'Достигнут лимит: 1 активное объявление. Снимите одно с продажи, чтобы вернуть это.']);

    expect($listing->fresh()?->status)->toBe($status);
})->with([
    'relist' => ['relist', ListingStatus::Withdrawn],
    'renew' => ['renew', ListingStatus::Expired],
]);

it('вернуть и продлить может только владелец и только из своего статуса', function () {
    $owner = User::factory()->create();
    $published = MyListingFixtures::listing($owner);
    $withdrawn = MyListingFixtures::listing($owner, ListingStatus::Withdrawn);

    $this->actingAs($owner)->post("/listings/{$published->id}/relist")->assertForbidden();
    $this->actingAs($owner)->post("/listings/{$withdrawn->id}/renew")->assertForbidden();
    $this->actingAs(User::factory()->create())->post("/listings/{$withdrawn->id}/relist")->assertNotFound();
    $this->actingAs(User::factory()->create())->post("/listings/{$withdrawn->id}/withdraw", ['reason' => 'changed_mind'])->assertNotFound();
});
