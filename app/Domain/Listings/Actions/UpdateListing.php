<?php

declare(strict_types=1);

namespace App\Domain\Listings\Actions;

use App\Domain\Catalog\Exceptions\SuggestionLimitReached;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use Illuminate\Validation\ValidationException;

/**
 * «Изменить» опубликованное объявление (UC-L3): содержимое формы → модель → правка через ListingStateMachine::edit().
 * Вид правки (существенная — на проверку при включённой премодерации, цена и прочее — без неё) определяет машина,
 * история цены пишется там же. Город объявления при изменении не меняется: он взят из шапки при публикации (BR-01).
 */
final class UpdateListing
{
    public function __construct(
        private readonly ResolveListingModel $resolveModel,
        private readonly ListingStateMachine $machine,
    ) {}

    /**
     * @param  array{category_id: int, title: string, model_id?: int|null, year?: int|null, serial?: string|null, condition: string, description?: string|null, price: int|null, negotiable: bool, meet: bool, ship: bool}  $content  без ключа `serial` серийный номер не меняется
     *
     * @throws SuggestionLimitReached суточный лимит предложений моделей исчерпан
     * @throws ValidationException контакты в названии или описании
     */
    public function __invoke(Listing $listing, array $content, bool $photosChanged): Listing
    {
        $description = trim((string) ($content['description'] ?? ''));
        $attributes = [
            'category_id' => $content['category_id'],
            'model_id' => $content['model_id'] ?? $this->resolveModel->resolve($listing, $content['title'], $content['category_id']),
            'title' => $content['title'],
            'year' => $content['year'] ?? null,
            'condition' => $content['condition'],
            'description' => $description === '' ? null : $description,
            'price' => $content['price'],
            'negotiable' => $content['negotiable'],
            'meet' => $content['meet'],
            'ship' => $content['ship'],
        ];
        if (array_key_exists('serial', $content)) {
            $serial = trim((string) $content['serial']);
            $attributes['serial_enc'] = $serial === '' ? null : $serial;
        }

        return $this->machine->edit($listing, $attributes, $photosChanged);
    }
}
