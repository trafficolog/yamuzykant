<?php

declare(strict_types=1);

namespace App\Http\Resources\Listings;

use App\Domain\Listings\Enums\PriceMode;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use Illuminate\Http\Request;

/**
 * Содержимое объявления для формы «Продать инструмент» / «Изменить»: восстановление черновика и правка опубликованного.
 * Серийный номер целиком на фронт не уходит (AGENTS.md §4) — только маска.
 */
final class ListingFormProps
{
    /**
     * Фото объявления для загрузчика формы: сначала фото серийного номера, затем по порядку.
     *
     * @return list<array<string, mixed>>
     */
    public static function photos(Listing $listing, Request $request): array
    {
        $photos = ListingPhoto::query()
            ->where('listing_id', $listing->id)
            ->orderByDesc('is_serial')
            ->orderBy('position')
            ->get();

        /** @var list<array<string, mixed>> $resolved */
        $resolved = ListingPhotoResource::collection($photos)->resolve($request);

        return $resolved;
    }

    /**
     * null — форма ещё ни разу не сохранялась (название не записано): страница остаётся с настройками по умолчанию.
     *
     * @return array<string, mixed>|null
     */
    public static function for(Listing $listing): ?array
    {
        // Черновики 2.1.3 и опубликованные заполнены без draft_price_mode: режим выводится из price (BR-11).
        $priceMode = $listing->draft_price_mode ?? match (true) {
            $listing->title === null => null,
            $listing->price === null => PriceMode::Negotiable->value,
            $listing->price === 0 => PriceMode::Free->value,
            default => PriceMode::Amount->value,
        };
        if ($priceMode === null) {
            return null;
        }

        return [
            'kind_id' => $listing->category_id,
            'title' => $listing->title,
            'model_id' => $listing->model_id,
            'year' => $listing->year,
            'serial_masked' => $listing->serialMasked(),
            'condition' => $listing->condition?->value,
            'description' => $listing->description,
            'price_mode' => $priceMode,
            'price' => $listing->price,
            'negotiable' => $listing->negotiable,
            'meet' => $listing->meet,
            'ship' => $listing->ship,
        ];
    }
}
