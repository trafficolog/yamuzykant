<?php

declare(strict_types=1);

namespace App\Domain\Listings\Actions;

use App\Domain\Catalog\Actions\SuggestInstrumentModel;
use App\Domain\Catalog\Exceptions\SuggestionLimitReached;
use App\Domain\Catalog\Models\InstrumentModel;
use App\Domain\Listings\Models\Listing;

/**
 * Модель для названия без выбора из подсказки (UC-L1 2a): уже привязанная к объявлению, если это она же,
 * иначе предложенная продавцом (общий суточный лимит предложений). Общий шаг записи формы: черновик и изменение.
 */
final class ResolveListingModel
{
    public function __construct(private readonly SuggestInstrumentModel $suggest) {}

    /** @throws SuggestionLimitReached суточный лимит предложений моделей исчерпан */
    public function __invoke(Listing $listing, string $title, int $categoryId): int
    {
        if ($listing->model_id !== null) {
            $current = InstrumentModel::query()->find($listing->model_id);
            if ($current !== null && SuggestInstrumentModel::isSame($current, $title)) {
                return $current->id;
            }
        }

        return $this->suggest->forUser($listing->user_id, $title, $categoryId)->id;
    }
}
