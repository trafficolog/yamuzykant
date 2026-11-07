<?php

declare(strict_types=1);

namespace App\Domain\Listings\Actions;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Exceptions\PhotoRejected;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Domain\Listings\Photos\PendingPhotoUploads;
use App\Domain\Listings\Photos\PendingUpload;
use App\Domain\Listings\Photos\PhotoStorage;
use App\Domain\Listings\Photos\PhotoUploads;
use App\Domain\Listings\Photos\UploadTicket;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Str;

/**
 * Выдать подписанный URL загрузки фото (короткий срок, размер и тип — в подписи).
 * Права (владелец, редактируемый статус) и тип/размер проверены до вызова: ListingPolicy::update, Form Request.
 */
final class RequestPhotoUpload
{
    public function __construct(
        private readonly PhotoUploads $uploads,
        private readonly PendingPhotoUploads $pending,
    ) {}

    /**
     * @return array{PendingUpload, UploadTicket}
     *
     * @throws PhotoRejected у объявления уже максимум фото
     */
    public function handle(Listing $listing, User $user, string $contentType, int $size): array
    {
        if (ListingPhoto::query()->where('listing_id', $listing->id)->counted()->count() >= Config::integer('photos.max')) {
            throw PhotoRejected::tooMany();
        }

        $id = (string) Str::uuid();
        $upload = new PendingUpload(
            id: $id,
            listingId: $listing->id,
            userId: $user->id,
            key: PhotoStorage::uploadKey($listing->id, $id),
            contentType: $contentType,
            size: $size,
        );
        $this->pending->put($upload);

        $ticket = $this->uploads->ticket($upload->key, $contentType, $size, now()->addSeconds(Config::integer('photos.upload_ttl')));

        return [$upload, $ticket];
    }
}
