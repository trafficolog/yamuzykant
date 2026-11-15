<?php

declare(strict_types=1);

namespace App\Http\Requests\Listings;

use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use Illuminate\Support\Facades\Gate;

/**
 * Форма «Изменить» опубликованного объявления (UC-L3, 2.1.5): те же правила и тексты, что у публикации
 * (StoreListingRequest), объявление — из адреса, а не из тела. Изменяет только владелец опубликованного объявления.
 * Фото пишутся сразу через ListingPhotoController, и существенной правкой их делает сервер (машина статусов), а не форма.
 */
final class UpdateListingRequest extends StoreListingRequest
{
    public function authorize(): bool
    {
        $listing = $this->route('listing');
        abort_unless($listing instanceof Listing, 404);
        Gate::forUser($this->user())->authorize('edit', $listing);

        return true;
    }

    protected function prepareForValidation(): void
    {
        $listing = $this->route('listing');
        $this->merge(['listing_id' => $listing instanceof Listing ? $listing->id : null]);
    }

    protected function listingStatus(): ListingStatus
    {
        return ListingStatus::Published;
    }
}
