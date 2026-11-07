<?php

declare(strict_types=1);

namespace App\Domain\Listings\Actions;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Exceptions\PhotoRejected;
use App\Domain\Listings\Jobs\ProcessListingPhoto;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Domain\Listings\Photos\ImageDimensions;
use App\Domain\Listings\Photos\ImageType;
use App\Domain\Listings\Photos\PendingPhotoUploads;
use App\Domain\Listings\Photos\PhotoStorage;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Подтвердить загрузку (ARCHITECTURE §7): загрузка выдана этому владельцу к этому объявлению,
 * файл есть, не больше 15 МБ, по содержимому — JPEG, PNG или HEIC, не больше photos.max_pixels. Иначе файл удаляется.
 * Новое фото опубликованного объявления — существенная правка через ListingStateMachine::edit().
 */
final class ConfirmPhotoUpload
{
    public function __construct(
        private readonly PendingPhotoUploads $pending,
        private readonly ListingStateMachine $machine,
    ) {}

    /** @throws PhotoRejected */
    public function handle(Listing $listing, User $user, string $uploadId, bool $serial): ListingPhoto
    {
        $upload = $this->pending->find($uploadId);
        if ($upload === null || $upload->listingId !== $listing->id || $upload->userId !== $user->id) {
            throw PhotoRejected::missingUpload();
        }
        // Забираем атомарно: второе подтверждение той же загрузки (в том числе параллельное) не пройдёт.
        if ($this->pending->pull($uploadId) === null) {
            throw PhotoRejected::missingUpload();
        }

        $disk = PhotoStorage::disk();
        if (! $disk->exists($upload->key)) {
            throw PhotoRejected::missingUpload();
        }

        $this->rejectUnless($disk->size($upload->key) <= Config::integer('photos.max_bytes'), $upload->key, PhotoRejected::tooLarge());
        $head = PhotoStorage::head($upload->key, ImageDimensions::HEAD_BYTES);
        $type = ImageType::sniff(substr($head, 0, ImageType::SNIFF_BYTES));
        $this->rejectUnless($type !== null, $upload->key, PhotoRejected::notImage());

        // «Бомба распаковки»: размер в пикселях по заголовку. HEIC и JPEG с заголовком дальше HEAD_BYTES
        // проверяет job до декодирования.
        $dimensions = ImageDimensions::of($head);
        $this->rejectUnless($dimensions === null || ! ImageDimensions::tooLarge(...$dimensions), $upload->key, PhotoRejected::tooManyPixels());

        $photo = DB::transaction(function () use ($listing, $upload, $serial): ListingPhoto {
            // Блокировка объявления: лимит, серийное фото и позиция считаются без гонки параллельных загрузок.
            Listing::query()->whereKey($listing->id)->lockForUpdate()->firstOrFail();
            $photos = ListingPhoto::query()->where('listing_id', $listing->id);

            $this->rejectUnless((clone $photos)->counted()->count() < Config::integer('photos.max'), $upload->key, PhotoRejected::tooMany());
            $this->rejectUnless(! $serial || ! (clone $photos)->counted()->where('is_serial', true)->exists(), $upload->key, PhotoRejected::serialExists());

            $position = (clone $photos)->max('position');

            return ListingPhoto::query()->create([
                'listing_id' => $listing->id,
                'path' => PhotoStorage::photoDirectory($listing->id, (string) Str::uuid()),
                'upload_key' => $upload->key,
                'position' => $position === null ? 0 : ((int) $position) + 1,
                'is_serial' => $serial,
            ]);
        });

        if ($listing->status === ListingStatus::Published) {
            $this->machine->edit($listing, [], photosChanged: true);
        }

        ProcessListingPhoto::dispatch($photo->id);

        return $photo;
    }

    private function rejectUnless(bool $condition, string $key, PhotoRejected $rejection): void
    {
        if (! $condition) {
            PhotoStorage::disk()->delete($key);

            throw $rejection;
        }
    }
}
