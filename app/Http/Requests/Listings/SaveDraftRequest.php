<?php

declare(strict_types=1);

namespace App\Http\Requests\Listings;

use App\Domain\Catalog\Enums\InstrumentModelStatus;
use App\Domain\Listings\Enums\Condition;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Enums\PriceMode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;

/**
 * Автосохранение и «Сохранить черновик» (UC-L1 7b, PUT /sell/draft): любое подмножество полей формы, ничего не
 * обязательно. Пределы те же, что у публикации (StoreListingRequest), но без проверок полноты, фото и контактов:
 * их выполняет публикация. Черновик должен принадлежать вошедшему и быть в статусе draft; город, владелец и статус
 * в запросе не принимаются.
 */
final class SaveDraftRequest extends FormRequest
{
    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'listing_id' => [
                'required',
                'uuid',
                Rule::exists('listings', 'id')
                    ->where('user_id', $this->user()?->id)
                    ->where('status', ListingStatus::Draft->value),
            ],
            'category_id' => ['nullable', 'integer', Rule::exists('categories', 'id')->where('is_visible', true)->whereNull('parent_id')],
            'title' => ['nullable', 'string', 'max:'.StoreListingRequest::TITLE_MAX],
            'model_id' => ['nullable', 'integer', Rule::exists('instrument_models', 'id')->where('status', InstrumentModelStatus::Active->value)],
            'year' => ['nullable', 'integer', 'between:'.StoreListingRequest::YEAR_MIN.','.now()->year],
            'serial' => ['nullable', 'string', 'max:'.StoreListingRequest::SERIAL_MAX],
            'condition' => ['nullable', Rule::enum(Condition::class)],
            'description' => ['nullable', 'string', 'max:'.StoreListingRequest::DESCRIPTION_MAX],
            'price_mode' => ['nullable', Rule::enum(PriceMode::class)],
            'price' => ['nullable', 'integer', 'between:0,'.StoreListingRequest::PRICE_MAX],
            'negotiable' => ['nullable', 'boolean'],
            'meet' => ['nullable', 'boolean'],
            'ship' => ['nullable', 'boolean'],
        ];
    }

    /**
     * Присланные поля формы без listing_id: ключи, которых нет в запросе, не меняют черновик.
     *
     * @return array<string, mixed>
     */
    public function content(): array
    {
        return Arr::except($this->validated(), ['listing_id']);
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        /** @var array<string, string> $messages */
        $messages = Arr::dot((array) __('listings.form.messages'));

        return $messages;
    }
}
