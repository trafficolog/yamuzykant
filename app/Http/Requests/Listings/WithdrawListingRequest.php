<?php

declare(strict_types=1);

namespace App\Http\Requests\Listings;

use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\Models\Listing;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * «Снять с продажи» (UC-L4, 2.1.5): причина из списка продавца (`moderation` — только система) и необязательная
 * итоговая цена, больше нуля, только для «продал». Права — ListingPolicy::withdraw.
 */
final class WithdrawListingRequest extends FormRequest
{
    /** Причины, которые выбирает продавец. */
    public const REASONS = [WithdrawReason::SoldHere, WithdrawReason::SoldElsewhere, WithdrawReason::ChangedMind];

    public function authorize(): bool
    {
        $listing = $this->route('listing');
        abort_unless($listing instanceof Listing, 404);
        Gate::forUser($this->user())->authorize('withdraw', $listing);

        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'reason' => ['required', Rule::in(array_map(fn (WithdrawReason $reason): string => $reason->value, self::REASONS))],
            'final_price' => [
                'nullable',
                'integer',
                'between:1,'.StoreListingRequest::PRICE_MAX,
                'prohibited_unless:reason,'.WithdrawReason::SoldHere->value.','.WithdrawReason::SoldElsewhere->value,
            ],
        ];
    }

    public function reason(): WithdrawReason
    {
        return WithdrawReason::from($this->string('reason')->toString());
    }

    public function finalPrice(): ?int
    {
        return $this->filled('final_price') ? $this->integer('final_price') : null;
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'reason.required' => (string) __('listings.manage.messages.reason.required'),
            'reason.in' => (string) __('listings.manage.messages.reason.required'),
            'final_price.integer' => (string) __('listings.manage.messages.final_price.integer'),
            'final_price.between' => (string) __('listings.manage.messages.final_price.between', ['min' => 1, 'max' => StoreListingRequest::PRICE_MAX]),
            'final_price.prohibited_unless' => (string) __('listings.manage.messages.final_price.prohibited'),
        ];
    }
}
