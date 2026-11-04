<?php

declare(strict_types=1);

use App\Domain\Listings\Exceptions\PhotoRequirementsNotMet;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Domain\Listings\Rules\PhotoRequirements;

// BR-03, UC-L1 п. 4: минимум 3 фото, одно — серийный номер, максимум 12. Проверку вызывает публикация (2.1.4).

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

function listingWithPhotos(int $count, bool $serial = true, int $failed = 0): Listing
{
    $listing = Listing::factory()->create();
    for ($i = 0; $i < $count; $i++) {
        $photo = ListingPhoto::query()->create([
            'listing_id' => $listing->id,
            'path' => "photos/{$listing->id}/{$i}",
            'position' => $i,
            'is_serial' => $serial && $i === 0,
        ]);
        if ($i >= $count - $failed) {
            $photo->forceFill(['failed_reason' => 'unreadable'])->save();
        }
    }

    return $listing;
}

it('3 фото с серийным номером — можно публиковать', function () {
    $check = PhotoRequirements::check(listingWithPhotos(3));

    expect($check->satisfied())->toBeTrue()
        ->and($check->missingPhotos)->toBe(0)
        ->and($check->missingSerial)->toBeFalse()
        ->and($check->messages())->toBe([]);

    PhotoRequirements::assertSatisfied(listingWithPhotos(12));
});

it('2 фото — не хватает одного', function () {
    $check = PhotoRequirements::check(listingWithPhotos(2));

    expect($check->satisfied())->toBeFalse()
        ->and($check->missingPhotos)->toBe(1)
        ->and($check->messages())->toBe(['ещё 1 фото']);
});

it('без фото серийного номера — нельзя', function () {
    $check = PhotoRequirements::check(listingWithPhotos(4, serial: false));

    expect($check->missingSerial)->toBeTrue()
        ->and($check->messages())->toBe(['фото серийного номера']);
});

it('фото с ошибкой обработки не считаются', function () {
    $check = PhotoRequirements::check(listingWithPhotos(3, failed: 1));

    expect($check->missingPhotos)->toBe(1);
});

it('больше 12 — нельзя', function () {
    $check = PhotoRequirements::check(listingWithPhotos(13));

    expect($check->extraPhotos)->toBe(1)
        ->and($check->satisfied())->toBeFalse()
        ->and($check->messages())->toBe(['удалите 1 фото: можно не больше 12']);
});

it('assertSatisfied бросает исключение со списком недостающего', function () {
    expect(fn () => PhotoRequirements::assertSatisfied(listingWithPhotos(0)))
        ->toThrow(PhotoRequirementsNotMet::class, 'ещё 3 фото, фото серийного номера');
});
