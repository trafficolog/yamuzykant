<?php

declare(strict_types=1);

namespace App\Domain\Listings\Actions;

use App\Domain\Catalog\Actions\SuggestInstrumentModel;
use App\Domain\Catalog\Exceptions\SuggestionLimitReached;
use App\Domain\Catalog\Models\InstrumentModel;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Enums\PriceMode;
use App\Domain\Listings\Models\Listing;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * Записывает полное содержимое формы «Продать инструмент» в черновик (UC-L1 п. 1–6) при публикации. Статус не меняется:
 * его меняет ListingStateMachine (PublishListing); неполную форму сохраняет AutosaveListingDraft. Модель без выбора из подсказки сохраняется
 * как предложенная продавцом (UC-L1 2a) и привязывается к черновику; предложение идёт через общий суточный лимит
 * (SuggestInstrumentModel::forUser), а повторная отправка с той же моделью лимит не расходует.
 */
final class SaveListingDraft
{
    public function __construct(private readonly SuggestInstrumentModel $suggest) {}

    /**
     * @param  array{category_id: int, title: string, model_id?: int|null, year?: int|null, serial?: string|null, condition: string, description?: string|null, price: int|null, negotiable: bool, meet: bool, ship: bool}  $data  без ключа `serial` серийный номер не меняется
     *
     * @throws LogicException объявление не в статусе draft: опубликованное правится через ListingStateMachine::edit()
     * @throws SuggestionLimitReached суточный лимит предложений моделей исчерпан
     */
    public function __invoke(Listing $listing, array $data, ?int $cityId): Listing
    {
        return DB::transaction(function () use ($listing, $data, $cityId): Listing {
            $fresh = Listing::query()->whereKey($listing->getKey())->lockForUpdate()->firstOrFail();
            if ($fresh->status !== ListingStatus::Draft) {
                throw new LogicException('Форма записывает только черновик.');
            }

            $modelId = $data['model_id'] ?? $this->suggestedModelId($fresh, $data);
            $description = trim((string) ($data['description'] ?? ''));

            $fresh->fill([
                'category_id' => $data['category_id'],
                'model_id' => $modelId,
                'title' => $data['title'],
                'year' => $data['year'] ?? null,
                'condition' => $data['condition'],
                'description' => $description === '' ? null : $description,
                'price' => $data['price'],
                'negotiable' => $data['negotiable'],
                'meet' => $data['meet'],
                'ship' => $data['ship'],
                'city_id' => $cityId,
            ]);
            if (array_key_exists('serial', $data)) {
                $serial = trim((string) $data['serial']);
                $fresh->serial_enc = $serial === '' ? null : $serial;
            }
            // Режим цены черновика вытекает из price (BR-11): если публикацию отклонят, форма восстановится верно.
            $fresh->draft_price_mode = match (true) {
                $data['price'] === null => PriceMode::Negotiable->value,
                $data['price'] === 0 => PriceMode::Free->value,
                default => PriceMode::Amount->value,
            };
            $fresh->save();

            return $fresh;
        });
    }

    /**
     * Модель для названия без выбора из подсказки: уже привязанная к черновику, если это она же, иначе предложенная.
     *
     * @param  array{category_id: int, title: string}  $data
     */
    private function suggestedModelId(Listing $listing, array $data): int
    {
        if ($listing->model_id !== null) {
            $current = InstrumentModel::query()->find($listing->model_id);
            if ($current !== null && SuggestInstrumentModel::isSame($current, $data['title'])) {
                return $current->id;
            }
        }

        return $this->suggest->forUser($listing->user_id, $data['title'], $data['category_id'])->id;
    }
}
