<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Http\Resources\Listings\ListingPhotoResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

// Раздача фото браузеру — через приложение (MinIO наружу не открыт): только готовые версии,
// права как у объявления, исходник по URL недоступен.

beforeEach(function () {
    config(['scout.driver' => 'null']);
    Storage::fake(config('photos.disk'));
});

function readyPhoto(Listing $listing, bool $serial = false): ListingPhoto
{
    $photo = ListingPhoto::query()->create([
        'listing_id' => $listing->id,
        'path' => "photos/{$listing->id}/p1",
        'position' => 0,
        'is_serial' => $serial,
    ]);
    $photo->forceFill(['processed_at' => now(), 'phash' => '0123456789abcdef'])->save();
    foreach (['square', 'wide'] as $variant) {
        foreach (['webp', 'avif'] as $format) {
            Storage::disk(config('photos.disk'))->put("{$photo->path}/{$variant}.{$format}", "{$variant}-{$format}");
        }
    }

    return $photo;
}

it('опубликованное фото видно всем, кэшируется надолго', function () {
    $photo = readyPhoto(Listing::factory()->inStatus(ListingStatus::Published)->create());

    $response = $this->get("/media/photos/{$photo->id}/wide.avif");

    $response->assertOk()->assertHeader('Content-Type', 'image/avif');
    expect($response->streamedContent())->toBe('wide-avif')
        ->and((string) $response->headers->get('Cache-Control'))->toContain('public')->toContain('immutable');
    $this->get("/media/photos/{$photo->id}/square.webp")->assertOk()->assertHeader('Content-Type', 'image/webp');
});

it('фото черновика видно только владельцу и не кэшируется публично', function () {
    $owner = User::factory()->create();
    $photo = readyPhoto(Listing::factory()->for($owner)->create());

    $this->get("/media/photos/{$photo->id}/square.webp")->assertNotFound();
    $this->actingAs(User::factory()->create())->get("/media/photos/{$photo->id}/square.webp")->assertNotFound();

    $response = $this->actingAs($owner)->get("/media/photos/{$photo->id}/square.webp");
    $response->assertOk();
    expect((string) $response->headers->get('Cache-Control'))->toContain('private');
});

it('исходник и посторонние имена не отдаются', function (string $name) {
    $photo = readyPhoto(Listing::factory()->inStatus(ListingStatus::Published)->create());

    $this->get("/media/photos/{$photo->id}/{$name}")->assertNotFound();
})->with(['original.jpg', 'square.jpg', 'wide.png', '..%2Fsquare.webp', 'upload.webp']);

it('необработанное фото — 404', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create();
    $photo = ListingPhoto::query()->create(['listing_id' => $listing->id, 'path' => 'photos/x/y', 'position' => 0]);

    $this->get("/media/photos/{$photo->id}/square.webp")->assertNotFound();
});

it('не опубликованное (снято, истекло, на проверке, на доработке): гостю и чужому — 404, владельцу — без публичного кэша', function (ListingStatus $status) {
    // Решение OWNER 07.11.2026 (SPEC §6.1): не опубликованное видят только владелец и сотрудники.
    $owner = User::factory()->create();
    $photo = readyPhoto(Listing::factory()->for($owner)->inStatus($status)->create());

    $this->get("/media/photos/{$photo->id}/square.webp")->assertNotFound();
    $this->actingAs(User::factory()->create())->get("/media/photos/{$photo->id}/square.webp")->assertNotFound();

    $response = $this->actingAs($owner)->get("/media/photos/{$photo->id}/square.webp");
    $response->assertOk();
    $cache = (string) $response->headers->get('Cache-Control');
    expect($cache)->toContain('private')
        ->and(str_contains($cache, 'public'))->toBeFalse()
        ->and(str_contains($cache, 'immutable'))->toBeFalse();
})->with([
    'withdrawn' => [ListingStatus::Withdrawn],
    'expired' => [ListingStatus::Expired],
    'pending' => [ListingStatus::Pending],
    'needs_changes' => [ListingStatus::NeedsChanges],
    'rejected' => [ListingStatus::Rejected],
]);

it('фото серийного номера опубликованного: гостю и чужому — 404, владельцу — без кэша', function () {
    $owner = User::factory()->create();
    $photo = readyPhoto(Listing::factory()->for($owner)->inStatus(ListingStatus::Published)->create(), serial: true);

    $this->get("/media/photos/{$photo->id}/square.webp")->assertNotFound();
    $this->actingAs(User::factory()->create())->get("/media/photos/{$photo->id}/wide.avif")->assertNotFound();

    $response = $this->actingAs($owner)->get("/media/photos/{$photo->id}/square.webp");
    $response->assertOk();
    expect((string) $response->headers->get('Cache-Control'))->toContain('private')->toContain('no-store');
});

it('в Resource для не-владельца у фото серийного номера нет URL', function () {
    $owner = User::factory()->create();
    $serial = readyPhoto(Listing::factory()->for($owner)->inStatus(ListingStatus::Published)->create(), serial: true);

    $guest = Request::create('/');
    $stranger = Request::create('/');
    $stranger->setUserResolver(fn () => User::factory()->create());
    $ownerRequest = Request::create('/');
    $ownerRequest->setUserResolver(fn () => $owner);

    expect((new ListingPhotoResource($serial))->toArray($guest)['urls'])->toBeNull()
        ->and((new ListingPhotoResource($serial))->toArray($stranger)['urls'])->toBeNull()
        ->and((new ListingPhotoResource($serial))->toArray($ownerRequest)['urls'])->not->toBeNull();
});
