<?php

declare(strict_types=1);

namespace App\Domain\Listings\Actions;

use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Exceptions\PhotoRejected;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Domain\Listings\Photos\PhotoStorage;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;

/**
 * Удалить фото вместе с файлами; порядок остальных — без пропусков. У опубликованного объявления
 * удаление — существенная правка, и после него должны остаться фото серийного номера и минимум 3 фото.
 */
final class DeleteListingPhoto
{
    public function __construct(private readonly ListingStateMachine $machine) {}

    /** @throws PhotoRejected */
    public function handle(Listing $listing, ListingPhoto $photo): void
    {
        DB::transaction(function () use ($listing, $photo): void {
            Listing::query()->whereKey($listing->id)->lockForUpdate()->firstOrFail();

            if ($listing->status === ListingStatus::Published) {
                $rest = ListingPhoto::query()->where('listing_id', $listing->id)->whereKeyNot($photo->id)->counted();
                $enough = (clone $rest)->count() >= Config::integer('photos.min')
                    && (clone $rest)->where('is_serial', true)->exists();
                if (! $enough) {
                    throw PhotoRejected::publishedMinimum();
                }
            }

            $photo->delete();
            ReorderListingPhotos::renumber($listing, ListingPhoto::query()->where('listing_id', $listing->id)->orderBy('position')->pluck('id')->all());
        });

        PhotoStorage::deleteVersions($photo->path);
        if ($photo->upload_key !== null) {
            PhotoStorage::disk()->delete($photo->upload_key);
        }

        if ($listing->status === ListingStatus::Published) {
            $this->machine->edit($listing, [], photosChanged: true);
        }
    }
}
