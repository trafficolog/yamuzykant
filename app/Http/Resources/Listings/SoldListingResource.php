<?php

declare(strict_types=1);

namespace App\Http\Resources\Listings;

use App\Domain\Listings\Models\Listing;
use App\Support\PostedAgo;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Проданное объявление на странице продавца: без цены (итоговая цена не публична, BR-11), без фото и ссылки —
 * снятое объявление открывают только владелец и сотрудники (SPEC §6.1). Нужны связи `city` и `saleRecord`.
 *
 * @mixin Listing
 */
final class SoldListingResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $soldAt = $this->saleRecord->sold_at ?? $this->unpublished_at;

        return [
            'id' => $this->id,
            'title' => (string) $this->title,
            'city' => $this->city?->name,
            'sold' => $soldAt === null ? null : PostedAgo::format($soldAt),
        ];
    }
}
