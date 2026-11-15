<?php

declare(strict_types=1);

namespace App\Http\Resources\Listings;

use App\Domain\Favorites\Queries\FavoriteListingIds;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Domain\Listings\Photos\PhotoVisibility;
use App\Support\PostedAgo;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

/**
 * Карточка опубликованного объявления в списках страниц лота («Похожие») и продавца: явный список полей.
 * user_id, итоговая цена, описание и серийный номер наружу не уходят (BR-04, AGENTS §4). Цена — как в БД:
 * `null` — «Договорная», `0` — «Бесплатно» (BR-11), подпись выбирает фронт. Нужны связи `city` и `photos`.
 * `favorite` — объявление в избранном у зрителя (4.3.1); для списка — `cards()`: один запрос на весь список.
 *
 * @mixin Listing
 */
final class ListingCardResource extends JsonResource
{
    public function __construct(Listing $listing, private readonly bool $favorite = false)
    {
        parent::__construct($listing);
    }

    /**
     * @param  Collection<int, Listing>  $listings
     * @return array<int, array<mixed>>
     */
    public static function cards(Collection $listings, Request $request): array
    {
        $favorites = FavoriteListingIds::among($request->user(), $listings->map(fn (Listing $listing): string => $listing->id)->all());

        return $listings
            ->map(fn (Listing $listing): array => (new self($listing, isset($favorites[$listing->id])))->resolve($request))
            ->values()
            ->all();
    }

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
            'favorite' => $this->favorite,
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
