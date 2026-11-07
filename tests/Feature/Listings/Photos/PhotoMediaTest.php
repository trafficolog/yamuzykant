<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Accounts\Staff\StaffDirectory;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Http\Resources\Listings\ListingPhotoResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

// Раздача фото браузеру — через приложение (MinIO наружу не открыт): только готовые версии,
// права как у объявления, исходник по URL недоступен.

beforeEach(function () {
    config(['scout.driver' => 'null']);
    Storage::fake(config('photos.disk'));
});

function readyPhoto(Listing $listing, bool $serial = false, int $position = 0): ListingPhoto
{
    $photo = ListingPhoto::query()->create([
        'listing_id' => $listing->id,
        'path' => "photos/{$listing->id}/p{$position}",
        'position' => $position,
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

/**
 * Матрица видимости по решениям OWNER (G1.md), ожидание задано независимо от PhotoVisibility:
 * публично — только published и не серийное; владелец и сотрудник видят всё.
 */
it('матрица видимости: статус × тип фото × зритель — ответ контроллера, кэш и urls в Resource', function (ListingStatus $status, bool $serial, string $viewer) {
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
    $photo = readyPhoto(Listing::factory()->for($owner)->inStatus($status)->create(), $serial);
    $user = match ($viewer) {
        'guest' => null,
        'stranger' => User::factory()->create(),
        'owner' => $owner,
        default => $staff,
    };

    $isPublic = $status === ListingStatus::Published && ! $serial;
    $mayView = $isPublic || in_array($viewer, ['owner', 'staff'], true);

    $response = ($user === null ? $this : $this->actingAs($user))->get("/media/photos/{$photo->id}/square.webp");
    $urls = photoResourceUrls($photo, $user);

    expect($response->getStatusCode())->toBe($mayView ? 200 : 404)
        ->and($urls !== null)->toBe($mayView);

    if ($mayView) {
        $cache = (string) $response->headers->get('Cache-Control');
        expect(str_contains($cache, 'public'))->toBe($isPublic)
            ->and(str_contains($cache, 'immutable'))->toBe($isPublic)
            ->and(str_contains($cache, 'private'))->toBe(! $isPublic)
            ->and(str_contains($cache, 'no-store'))->toBe($serial);
    }
})->with(function () {
    foreach (ListingStatus::cases() as $status) {
        foreach ([false, true] as $serial) {
            foreach (['guest', 'stranger', 'owner', 'staff'] as $viewer) {
                yield sprintf('%s %s %s', $status->value, $serial ? 'serial' : 'regular', $viewer) => [$status, $serial, $viewer];
            }
        }
    }
});

it('список фото владельца: связь listing загружена заранее, запросов к listings не больше двух', function () {
    $owner = User::factory()->create();
    $listing = Listing::factory()->for($owner)->inStatus(ListingStatus::Published)->create();
    foreach (range(0, 3) as $position) {
        readyPhoto($listing, serial: $position === 0, position: $position);
    }

    $queries = 0;
    DB::listen(function ($query) use (&$queries): void {
        if (str_contains($query->sql, 'from "listings"')) {
            $queries++;
        }
    });
    $this->actingAs($owner)->getJson("/listings/{$listing->id}/photos")->assertOk()->assertJsonCount(4, 'data');

    // Привязка маршрута — один запрос; фото грузят listing одним запросом, а не по запросу на фото.
    expect($queries)->toBeLessThanOrEqual(2);
});
