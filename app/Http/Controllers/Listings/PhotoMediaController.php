<?php

declare(strict_types=1);

namespace App\Http\Controllers\Listings;

use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\ListingPhoto;
use App\Domain\Listings\Photos\PhotoFormat;
use App\Domain\Listings\Photos\PhotoStorage;
use App\Domain\Listings\Photos\PhotoVariant;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Раздача фото браузеру через приложение: MinIO на stage слушает только 127.0.0.1, бакет закрыт.
 * Отдаются только готовые версии (имя — из перечислений, исходник недоступен) с правами как у объявления:
 * фото черновика видит только владелец. Опубликованные кэшируются как неизменяемые — их можно отдавать
 * через CDN без изменений в коде.
 */
final class PhotoMediaController extends Controller
{
    /** Видимы гостю и могут кэшироваться публично (как ListingPolicy::view для гостя). */
    private const PUBLIC = [ListingStatus::Published, ListingStatus::Withdrawn, ListingStatus::Expired];

    public function __invoke(Request $request, ListingPhoto $photo, string $variant, string $format): StreamedResponse
    {
        $variant = PhotoVariant::tryFrom($variant);
        $format = PhotoFormat::tryFrom($format);
        $listing = $photo->listing;

        // 404, а не 403: чужой черновик не выдаёт даже факт существования фото.
        abort_if($variant === null || $format === null || ! $photo->isReady(), 404);
        abort_unless(Gate::forUser($request->user())->allows('view', $listing), 404);

        $public = in_array($listing->status, self::PUBLIC, true);

        return PhotoStorage::disk()->response($photo->variantPath($variant, $format), null, [
            'Content-Type' => $format->mime(),
            'Cache-Control' => $public ? 'public, max-age=31536000, immutable' : 'private, max-age=600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
