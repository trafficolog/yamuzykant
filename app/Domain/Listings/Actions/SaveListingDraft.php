<?php

declare(strict_types=1);

namespace App\Domain\Listings\Actions;

use App\Domain\Catalog\Actions\SuggestInstrumentModel;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * Записывает содержимое формы «Продать инструмент» в черновик (UC-L1 п. 1–6). Статус не меняется:
 * публикация — отдельное событие ListingStateMachine (2.1.4). Модель без выбора из подсказки сохраняется
 * как предложенная продавцом (UC-L1 2a) и привязывается к черновику.
 */
final class SaveListingDraft
{
    public function __construct(private readonly SuggestInstrumentModel $suggest) {}

    /**
     * @param  array{category_id: int, title: string, model_id?: int|null, year?: int|null, serial?: string|null, condition: string, description?: string|null, price: int|null, negotiable: bool, meet: bool, ship: bool}  $data
     *
     * @throws LogicException объявление не в статусе draft: опубликованное правится через ListingStateMachine::edit()
     */
    public function __invoke(Listing $listing, array $data, ?int $cityId): Listing
    {
        return DB::transaction(function () use ($listing, $data, $cityId): Listing {
            $fresh = Listing::query()->whereKey($listing->getKey())->lockForUpdate()->firstOrFail();
            if ($fresh->status !== ListingStatus::Draft) {
                throw new LogicException('Форма записывает только черновик.');
            }

            $modelId = $data['model_id'] ?? ($this->suggest)($data['title'], $data['category_id'])->id;
            $serial = trim((string) ($data['serial'] ?? ''));
            $description = trim((string) ($data['description'] ?? ''));

            $fresh->fill([
                'category_id' => $data['category_id'],
                'model_id' => $modelId,
                'title' => $data['title'],
                'year' => $data['year'] ?? null,
                'serial_enc' => $serial === '' ? null : $serial,
                'condition' => $data['condition'],
                'description' => $description === '' ? null : $description,
                'price' => $data['price'],
                'negotiable' => $data['negotiable'],
                'meet' => $data['meet'],
                'ship' => $data['ship'],
                'city_id' => $cityId,
            ]);
            $fresh->save();

            return $fresh;
        });
    }
}
