<?php

declare(strict_types=1);

namespace App\Http\Resources\Listings;

use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Domain\Listings\Photos\PhotoVisibility;
use App\Support\PostedAgo;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Карточка опубликованного объявления в списках страниц лота («Похожие») и продавца: явный список полей.
 * user_id, итоговая цена, описание и серийный номер наружу не уходят (BR-04, AGENTS §4). Цена — как в БД:
 * `null` — «Договорная», `0` — «Бесплатно» (BR-11), подпись выбирает фронт. Нужны связи `city` и `photos`.
 *
 * @mixin Listing
 */
final class ListingCardResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var Listing $listing */
        $listing = $this->resource;
        $price = $listing->price;

        return [
            'id' => $listing->id,
            'title' => (string) $listing->title,
            'price' => $price,
            'condition' => $listing->condition?->value,
            'city' => $listing->city?->name,
            'ship' => $listing->ship,
            'negotiable' => $price !== null && $price > 0 && $listing->negotiable,
            'posted' => $listing->published_at === null ? null : PostedAgo::format($listing->published_at),
            'image' => $this->cover($listing),
        ];
    }

    /** Обложка карточки: первое публичное фото (не серийный номер), версия 1:1. */
    private function cover(Listing $listing): ?string
    {
        $photo = $listing->photos->first(fn (ListingPhoto $photo): bool => ! $photo->is_serial && $photo->isReady());
        if ($photo === null) {
            return null;
        }
        $photo->setRelation('listing', $listing);
        if (! PhotoVisibility::isPublic($photo)) {
            return null;
        }

        return route('photos.media', [
            'photo' => $photo->id,
            'variant' => 'square',
            'format' => 'webp',
            'v' => $photo->processed_at?->getTimestamp(),
        ], absolute: false);
    }
}
