<?php

declare(strict_types=1);

namespace App\Http\Requests\Listings;

use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use Illuminate\Support\Facades\Gate;

/**
 * Форма «Изменить» опубликованного объявления (UC-L3, 2.1.5): те же правила и тексты, что у публикации
 * (StoreListingRequest), объявление — из адреса, а не из тела. Изменяет только владелец опубликованного объявления.
 * `photos_changed` — форма сообщает, что фото менялись (они пишутся сразу, а не вместе с формой): это существенная правка.
 */
final class UpdateListingRequest extends StoreListingRequest
{
    public function authorize(): bool
    {
        $listing = $this->route('listing');

        return $listing instanceof Listing && Gate::forUser($this->user())->allows('edit', $listing);
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

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [...parent::rules(), 'photos_changed' => ['sometimes', 'boolean']];
    }

    public function photosChanged(): bool
    {
        return $this->boolean('photos_changed');
    }
}
