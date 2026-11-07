<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Accounts\Staff\StaffDirectory;
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

/** Resource от имени зрителя: гость (null), чужой, владелец или сотрудник. */
function photoResourceUrls(ListingPhoto $photo, ?User $viewer): mixed
{
    $request = Request::create('/');
    $request->setUserResolver(fn () => $viewer);

    return (new ListingPhotoResource($photo))->toArray($request)['urls'];
}

it('не опубликованное: в Resource у гостя и чужого нет URL, у владельца и сотрудника есть', function (ListingStatus $status) {
    $owner = User::factory()->create();
    $staff = User::factory()->create();
    app()->instance(StaffDirectory::class, new class($staff) implements StaffDirectory
    {
        public function __construct(private readonly User $staff) {}

        public function isStaff(User $user): bool
        {
            return $user->is($this->staff);
        }
    });
    $photo = readyPhoto(Listing::factory()->for($owner)->inStatus($status)->create());

    expect(photoResourceUrls($photo, null))->toBeNull()
        ->and(photoResourceUrls($photo, User::factory()->create()))->toBeNull()
        ->and(photoResourceUrls($photo, $owner))->not->toBeNull()
        ->and(photoResourceUrls($photo, $staff))->not->toBeNull();
})->with([
    'withdrawn' => [ListingStatus::Withdrawn],
    'expired' => [ListingStatus::Expired],
    'pending' => [ListingStatus::Pending],
    'needs_changes' => [ListingStatus::NeedsChanges],
    'rejected' => [ListingStatus::Rejected],
]);

it('опубликованное: в Resource у гостя URL обычного фото есть, у серийного нет', function () {
    $regular = readyPhoto(Listing::factory()->inStatus(ListingStatus::Published)->create());
    $serial = readyPhoto(Listing::factory()->inStatus(ListingStatus::Published)->create(), serial: true);

    expect(photoResourceUrls($regular, null))->not->toBeNull()
        ->and(photoResourceUrls($serial, null))->toBeNull();
});

it('ссылка из Resource есть ровно тогда, когда PhotoMediaController отдаёт фото', function (ListingStatus $status, bool $serial, string $viewer) {
    $owner = User::factory()->create();
    $photo = readyPhoto(Listing::factory()->for($owner)->inStatus($status)->create(), $serial);
    $user = match ($viewer) {
        'guest' => null,
        'stranger' => User::factory()->create(),
        default => $owner,
    };

    $urls = photoResourceUrls($photo, $user);
    $test = $user === null ? $this : $this->actingAs($user);
    $served = $test->get("/media/photos/{$photo->id}/square.webp")->getStatusCode() === 200;

    expect($urls !== null)->toBe($served);
})->with(function () {
    foreach ([ListingStatus::Published, ListingStatus::Withdrawn, ListingStatus::Pending] as $status) {
        foreach ([false, true] as $serial) {
            foreach (['guest', 'stranger', 'owner'] as $viewer) {
                yield "{$status->value} serial={$serial} {$viewer}" => [$status, $serial, $viewer];
            }
        }
    }
});
