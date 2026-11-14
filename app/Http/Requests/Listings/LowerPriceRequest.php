<?php

declare(strict_types=1);

namespace App\Http\Requests\Listings;

use App\Domain\Listings\Models\Listing;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * Окно «Снизить цену» (UC-L3, 2.1.5): новая сумма — целые рубли, больше нуля и строго ниже текущей цены.
 * «Договорная» и «Бесплатно» меняются формой «Изменить». Права — ListingPolicy::edit.
 */
final class LowerPriceRequest extends FormRequest
{
    public function authorize(): bool
    {
        $listing = $this->route('listing');

        return $listing instanceof Listing && Gate::forUser($this->user())->allows('edit', $listing);
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        $listing = $this->route('listing');
        $current = $listing instanceof Listing ? (int) $listing->price : 0;

        return ['price' => ['required', 'integer', 'min:1', 'max:'.max($current - 1, 0)]];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        $listing = $this->route('listing');
        $current = $listing instanceof Listing ? (int) $listing->price : 0;

        return [
            'price.required' => (string) __('listings.manage.messages.price.required'),
            'price.integer' => (string) __('listings.manage.messages.price.required'),
            'price.min' => (string) __('listings.manage.messages.price.lower', ['current' => number_format($current, 0, '', "\u{00A0}")]),
            'price.max' => (string) __('listings.manage.messages.price.lower', ['current' => number_format($current, 0, '', "\u{00A0}")]),
        ];
    }

    public function price(): int
    {
        return $this->integer('price');
    }
}
