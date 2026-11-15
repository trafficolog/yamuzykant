<?php

declare(strict_types=1);

namespace App\Http\Resources\Listings;

use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Photos\PhotoVisibility;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Строка вкладки «Объявления»: явный список полей. Итоговая цена продажи, серийный номер и телефоны наружу не уходят.
 * Причина возврата или отклонения — дословно из решения модератора.
 *
 * @mixin Listing
 */
final class MyListingResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var Listing $listing */
        $listing = $this->resource;
        $cover = PhotoVisibility::cover($listing);
        $reason = in_array($listing->status, [ListingStatus::NeedsChanges, ListingStatus::Rejected], true)
            ? $listing->moderationDecisions->first()?->reason
            : null;

        return [
            'id' => $listing->id,
            'title' => (string) $listing->title,
            'price' => $listing->price,
            'negotiable' => $listing->negotiable,
            'status' => $listing->status->value,
            'cover' => $cover === null ? null : ListingPhotoResource::urlsFor($cover),
            'return_reason' => $reason,
            'chats' => (int) $listing->getAttribute('conversations_count'),
            'views' => $listing->views_count,
            'url' => route('lot.show', ['listing' => $listing->id], absolute: false),
        ];
    }
}
