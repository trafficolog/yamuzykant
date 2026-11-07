<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\ListingPhoto;
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
            || Gate::forUser($viewer)->allows('viewRestrictedPhotos', $photo->listing);
    }
}
