<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Domain\Messaging\Models\Conversation;
use Illuminate\Support\Facades\Gate;

/**
 * Единое правило видимости фото: его применяют и PhotoMediaController (раздача), и ListingPhotoResource
 * (ссылки), чтобы ссылка в ответе всегда совпадала с тем, что отдаст контроллер.
 *
 * Публично — только фото опубликованного объявления, кроме фото серийного номера (его, как и любые фото
 * объявления не в published, видят владелец и сотрудник: ListingPolicy::viewRestrictedPhotos).
 */
final class PhotoVisibility
{
    /** Фото можно отдавать любому зрителю (и кэшировать публично). */
    public static function isPublic(ListingPhoto $photo): bool
    {
        return $photo->listing->status === ListingStatus::Published && ! $photo->is_serial;
    }

    /** Фото отдаётся этому зрителю (гость — null). */
    public static function allows(?User $viewer, ListingPhoto $photo): bool
    {
        return self::isPublic($photo)
            || Gate::forUser($viewer)->allows('viewRestrictedPhotos', $photo->listing)
            || self::isConversationCover($viewer, $photo);
    }

    /**
     * Обложка объявления: первое готовое фото, не серийный номер. Фото берутся из связи `photos` объявления
     * (по `position`); связь загружена заранее, если обложки нужны списком.
     */
    public static function cover(Listing $listing): ?ListingPhoto
    {
        return $listing->photos->first(fn (ListingPhoto $photo): bool => ! $photo->is_serial && $photo->isReady());
    }

    /** Участник беседы по объявлению и это обложка объявления. */
    private static function isConversationCover(?User $viewer, ListingPhoto $photo): bool
    {
        if ($viewer === null || $photo->is_serial || ! $photo->isReady()) {
            return false;
        }

        $cover = self::cover($photo->listing);
        if ($cover === null || $cover->id !== $photo->id) {
            return false;
        }

        return Conversation::query()
            ->where('listing_id', $photo->listing_id)
            ->where(fn ($query) => $query->where('buyer_id', $viewer->id)->orWhere('seller_id', $viewer->id))
            ->exists();
    }
}
