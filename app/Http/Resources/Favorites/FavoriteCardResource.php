<?php

declare(strict_types=1);

namespace App\Http\Resources\Favorites;

use App\Domain\Favorites\Models\Favorite;
use App\Domain\Listings\Enums\ListingStatus;
use App\Http\Resources\Listings\ListingCardResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Карточка вкладки «Избранное» (UC-S5). Опубликованное — обычная карточка (ListingCardResource) и `old_price`,
 * если цена с момента добавления снизилась (в ListingCard ДС это значок скидки). Не опубликованное недоступно
 * (SPEC §6.1): наружу только id, название и цена — ни фото, ни города, ни описания, ни ссылки на страницу.
 *
 * @mixin Favorite
 */
final class FavoriteCardResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var Favorite $favorite */
        $favorite = $this->resource;
        $listing = $favorite->listing;
        $price = $listing->price;

        if ($listing->status !== ListingStatus::Published) {
            return [
                'id' => $listing->id,
                'title' => (string) $listing->title,
                'price' => $price,
                'available' => false,
                'favorite' => true,
            ];
        }

        $saved = $favorite->price_at_save;
        // «Бесплатно» (0) ListingCard нарисовал бы как «0 ₽» (BR-11): подсветки нет.
        $dropped = $price !== null && $price > 0 && $saved !== null && $saved > $price;

        return [
            ...(new ListingCardResource($listing, favorite: true))->resolve($request),
            'old_price' => $dropped ? $saved : null,
            'available' => true,
        ];
    }
}
