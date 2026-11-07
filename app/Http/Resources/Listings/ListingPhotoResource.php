<?php

declare(strict_types=1);

namespace App\Http\Resources\Listings;

use App\Domain\Listings\Models\ListingPhoto;
use App\Domain\Listings\Photos\PhotoFormat;
use App\Domain\Listings\Photos\PhotoVariant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/**
 * Фото для PhotoUploader и страниц объявления: только URL отдаваемых версий; путь в хранилище,
 * ключ исходника и pHash наружу не уходят. URL фото серийного номера — только владельцу и сотруднику.
 *
 * @mixin ListingPhoto
 */
final class ListingPhotoResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var ListingPhoto $photo */
        $photo = $this->resource;

        return [
            'id' => $photo->id,
            'position' => $photo->position,
            'is_serial' => $photo->is_serial,
            'state' => match (true) {
                $photo->isFailed() => 'failed',
                $photo->isReady() => 'ready',
                default => 'processing',
            },
            'error' => $photo->isFailed() ? __("photos.errors.{$photo->failed_reason}") : null,
            'urls' => $photo->isReady() && $this->mayShow($request, $photo) ? $this->urls($photo) : null,
        ];
    }

    /** Фото серийного номера — только владельцу и сотруднику (UC-L1, AGENTS.md §4). */
    private function mayShow(Request $request, ListingPhoto $photo): bool
    {
        return ! $photo->is_serial || Gate::forUser($request->user())->allows('viewRestrictedPhotos', $photo->listing);
    }

    /** @return array<string, array<string, string>> */
    private function urls(ListingPhoto $photo): array
    {
        $version = $photo->processed_at?->getTimestamp();
        $urls = [];
        foreach (PhotoVariant::cases() as $variant) {
            foreach (PhotoFormat::cases() as $format) {
                $urls[$variant->value][$format->value] = route('photos.media', [
                    'photo' => $photo->id,
                    'variant' => $variant->value,
                    'format' => $format->value,
                    'v' => $version,
                ], absolute: false);
            }
        }

        return $urls;
    }
}
