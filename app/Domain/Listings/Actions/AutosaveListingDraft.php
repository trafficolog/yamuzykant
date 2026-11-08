<?php

declare(strict_types=1);

namespace App\Domain\Listings\Actions;

use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Enums\PriceMode;
use App\Domain\Listings\Models\Listing;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * Автосохранение и «Сохранить черновик» (UC-L1 7b): записывает любое подмножество полей формы без обязательности.
 * Меняются только присланные ключи; пустая строка и null очищают поле. Статус не меняется. В отличие от публикации
 * не предлагает модель в справочник и не расходует суточный лимит предложений: модель привязывается, только если
 * выбрана из подсказки (model_id); текстом она уйдёт в «Предложено продавцами» при публикации.
 * Контакты в тексте не блокируются: блокирует только публикация (ListingAutoChecks::validate).
 */
final class AutosaveListingDraft
{
    /** Числовые и enum-поля: пишутся как есть, null очищает. */
    private const PLAIN = ['category_id', 'model_id', 'year', 'condition'];

    /**
     * @param  array<string, mixed>  $data  проверенные поля формы; без ключа поле не меняется
     *
     * @throws LogicException объявление не в статусе draft
     */
    public function __invoke(Listing $listing, array $data, ?int $cityId): Listing
    {
        return DB::transaction(function () use ($listing, $data, $cityId): Listing {
            $fresh = Listing::query()->whereKey($listing->getKey())->lockForUpdate()->firstOrFail();
            if ($fresh->status !== ListingStatus::Draft) {
                throw new LogicException('Автосохранение записывает только черновик.');
            }

            foreach (self::PLAIN as $field) {
                if (array_key_exists($field, $data)) {
                    $fresh->{$field} = $data[$field] ?? null;
                }
            }
            foreach (['title', 'description'] as $field) {
                if (array_key_exists($field, $data)) {
                    $fresh->{$field} = $this->text($data[$field]);
                }
            }
            if (array_key_exists('serial', $data)) {
                $fresh->serial_enc = $this->text($data['serial']);
            }
            foreach (['meet', 'ship'] as $field) {
                if (array_key_exists($field, $data) && $data[$field] !== null) {
                    $fresh->{$field} = (bool) $data[$field];
                }
            }
            $this->fillPrice($fresh, $data);
            if ($cityId !== null) {
                $fresh->city_id = $cityId;
            }
            $fresh->save();

            return $fresh;
        });
    }

    /**
     * Цена по режиму формы (BR-11): сумма, «Договорная» (null) или «Бесплатно» (0); «Готов к торгу» — только с суммой.
     *
     * @param  array<string, mixed>  $data
     */
    private function fillPrice(Listing $listing, array $data): void
    {
        $mode = isset($data['price_mode']) ? PriceMode::tryFrom((string) $data['price_mode']) : null;

        if ($mode === null) {
            if (array_key_exists('price', $data)) {
                $listing->price = isset($data['price']) ? (int) $data['price'] : null;
            }
            if (array_key_exists('negotiable', $data) && $data['negotiable'] !== null) {
                $listing->negotiable = (bool) $data['negotiable'];
            }

            return;
        }

        $listing->draft_price_mode = $mode->value;
        $listing->price = match ($mode) {
            PriceMode::Amount => isset($data['price']) ? (int) $data['price'] : null,
            PriceMode::Negotiable => null,
            PriceMode::Free => 0,
        };
        $listing->negotiable = $mode === PriceMode::Amount && (bool) ($data['negotiable'] ?? false);
    }

    private function text(mixed $value): ?string
    {
        $text = trim(is_string($value) ? $value : '');

        return $text === '' ? null : $text;
    }
}
