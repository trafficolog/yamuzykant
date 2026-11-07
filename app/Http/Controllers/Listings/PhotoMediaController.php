<?php

declare(strict_types=1);

namespace App\Http\Controllers\Listings;

use App\Domain\Listings\Models\ListingPhoto;
use App\Domain\Listings\Photos\PhotoFormat;
use App\Domain\Listings\Photos\PhotoStorage;
use App\Domain\Listings\Photos\PhotoVariant;
use App\Domain\Listings\Photos\PhotoVisibility;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Раздача фото браузеру через приложение: MinIO на stage слушает только 127.0.0.1, бакет закрыт.
 * Отдаются только готовые версии (имя — из перечислений, исходник недоступен).
 *
 * Кто видит: фото опубликованного объявления — все; фото серийного номера и любые фото объявления
 * не в published — только владелец и сотрудник (ListingPolicy::viewRestrictedPhotos), остальным 404.
 * Кэш: public + immutable — только опубликованные фото без серийного номера (их можно отдавать через CDN);
 * фото серийного номера — no-store; остальное — короткий private-кэш.
 */
final class PhotoMediaController extends Controller
{
    public function __invoke(Request $request, ListingPhoto $photo, string $variant, string $format): StreamedResponse
    {
        $variant = PhotoVariant::tryFrom($variant);
        $format = PhotoFormat::tryFrom($format);

        abort_if($variant === null || $format === null || ! $photo->isReady(), 404);

        $public = PhotoVisibility::isPublic($photo);
        // 404, а не 403: чужой черновик не выдаёт даже факт существования фото.
        abort_unless(PhotoVisibility::allows($request->user(), $photo), 404);

        $cache = match (true) {
            $public => 'public, max-age=31536000, immutable',
            $photo->is_serial => 'private, no-store',
            default => 'private, max-age=300',
        };

        return PhotoStorage::disk()->response($photo->variantPath($variant, $format), null, [
            'Content-Type' => $format->mime(),
            'Cache-Control' => $cache,
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
