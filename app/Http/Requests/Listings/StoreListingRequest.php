<?php

declare(strict_types=1);

namespace App\Http\Requests\Listings;

use App\Domain\Catalog\Actions\SuggestInstrumentModel;
use App\Domain\Catalog\Enums\InstrumentModelStatus;
use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\InstrumentModel;
use App\Domain\Listings\Enums\Condition;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Enums\PriceMode;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Rules\PhotoRequirements;
use Illuminate\Contracts\Validation\Validator as ValidatorContract;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;

/**
 * Форма «Продать инструмент» (UC-L1 п. 1–6): те же правила, что на клиенте (resources/js/lib/sellForm.ts),
 * но запрос приходит в обход клиента тоже. Вход проверяет middleware `auth` на маршруте; черновик должен
 * принадлежать вошедшему и быть в статусе draft. Город, владелец и статус в запросе не принимаются.
 *
 * Пределы — технические, до решения OWNER: название до 120 символов (как у предложения модели), описание
 * до 5000, серийный номер до 64, год с 1800, цена до 99 999 999 ₽. Проверка контактов в описании — 5.1.1.
 */
final class StoreListingRequest extends FormRequest
{
    public const TITLE_MAX = 120;

    public const DESCRIPTION_MAX = 5000;

    public const SERIAL_MAX = 64;

    public const YEAR_MIN = 1800;

    public const PRICE_MAX = 99_999_999;

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
            // Вид инструмента — корень дерева категорий (8 видов), видимый.
            'category_id' => [
                'required',
                'integer',
                Rule::exists('categories', 'id')->where('is_visible', true)->whereNull('parent_id'),
            ],
            // Бренд и модель — как в подсказке: два слова и больше (SuggestModelRequest).
            'title' => ['required', 'string', 'max:'.self::TITLE_MAX, 'regex:/^\S+\s+\S.*$/us'],
            'model_id' => [
                'nullable',
                'integer',
                Rule::exists('instrument_models', 'id')->where('status', InstrumentModelStatus::Active->value),
            ],
            'year' => ['nullable', 'integer', 'between:'.self::YEAR_MIN.','.now()->year],
            'serial' => ['nullable', 'string', 'max:'.self::SERIAL_MAX],
            'condition' => ['required', Rule::enum(Condition::class)],
            'description' => ['nullable', 'string', 'max:'.self::DESCRIPTION_MAX],
            // BR-11: цена — сумма, «Договорная» (price = null) или «Бесплатно» (price = 0). Сумма — только в режиме amount.
            'price_mode' => ['required', Rule::enum(PriceMode::class)],
            'price' => $this->input('price_mode') === PriceMode::Amount->value
                ? ['required', 'integer', 'between:1,'.self::PRICE_MAX]
                : ['prohibited'],
            'negotiable' => ['required', 'boolean'],
            'meet' => ['required', 'boolean'],
            'ship' => ['required', 'boolean'],
        ];
    }

    /** @return array<int, callable(ValidatorContract): void> */
    public function after(): array
    {
        return [function (ValidatorContract $validator): void {
            $errors = $validator->errors();

            if (! $errors->has('meet') && ! $errors->has('ship') && ! $this->boolean('meet') && ! $this->boolean('ship')) {
                $errors->add('meet', (string) __('listings.form.messages.meet.required_one'));
            }

            $this->validateModel($validator);

            // Фото — по черновику на сервере: клиентскому списку не верим (BR-03).
            if (! $errors->has('listing_id') && is_string($this->input('listing_id'))) {
                $listing = Listing::query()->find($this->input('listing_id'));
                if ($listing !== null) {
                    $shortfall = PhotoRequirements::check($listing);
                    if (! $shortfall->satisfied()) {
                        $errors->add('photos', implode(', ', $shortfall->messages()));
                    }
                }
            }
        }];
    }

    /**
     * Выбранная модель принадлежит дереву выбранного вида и совпадает с названием: чужую активную модель под другим
     * видом или с другим названием прислать нельзя.
     */
    private function validateModel(ValidatorContract $validator): void
    {
        $errors = $validator->errors();
        if ($errors->hasAny(['model_id', 'category_id', 'title']) || ! $this->filled('model_id')) {
            return;
        }

        $model = InstrumentModel::query()->find($this->integer('model_id'));
        if ($model === null) {
            return;
        }

        if (self::rootOf($model->category_id) !== $this->integer('category_id')) {
            $errors->add('model_id', (string) __('listings.form.messages.model_id.category'));
        } elseif (! SuggestInstrumentModel::isSame($model, $this->string('title')->toString())) {
            $errors->add('title', (string) __('listings.form.messages.title.model'));
        }
    }

    /** Корневой вид, в дереве которого лежит категория (вид → группа → пункт). */
    private static function rootOf(int $categoryId): ?int
    {
        for ($depth = 0; $depth < 8; $depth++) {
            $category = Category::query()->find($categoryId);
            if ($category === null) {
                return null;
            }
            if ($category->parent_id === null) {
                return $category->id;
            }
            $categoryId = $category->parent_id;
        }

        return null;
    }

    /**
     * Проверенное содержимое для SaveListingDraft: только поля формы, нужных типов.
     *
     * @return array{category_id: int, title: string, model_id: int|null, year: int|null, serial: string|null, condition: string, description: string|null, price: int|null, negotiable: bool, meet: bool, ship: bool}
     */
    public function content(): array
    {
        $data = $this->validated();
        $amount = $this->input('price_mode') === PriceMode::Amount->value;
        $text = fn (string $key): ?string => isset($data[$key]) && is_string($data[$key]) ? $data[$key] : null;

        return [
            'category_id' => $this->integer('category_id'),
            'title' => (string) $text('title'),
            'model_id' => isset($data['model_id']) ? $this->integer('model_id') : null,
            'year' => isset($data['year']) ? $this->integer('year') : null,
            'serial' => $text('serial'),
            'condition' => (string) $text('condition'),
            'description' => $text('description'),
            'price' => $amount ? $this->integer('price') : ($this->input('price_mode') === PriceMode::Free->value ? 0 : null),
            // BR-11: «Готов к торгу» — только при указанной сумме.
            'negotiable' => $amount && $this->boolean('negotiable'),
            'meet' => $this->boolean('meet'),
            'ship' => $this->boolean('ship'),
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        /** @var array<string, string> $messages */
        $messages = Arr::dot((array) __('listings.form.messages'));

        return $messages;
    }
}
