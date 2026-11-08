<?php

declare(strict_types=1);

namespace App\Domain\Listings\Actions;

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Exceptions\SuggestionLimitReached;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Exceptions\ListingLimitReached;
use App\Domain\Listings\Exceptions\PhotoRequirementsNotMet;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Rules\ActiveListingLimit;
use App\Domain\Listings\Rules\PhotoRequirements;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use App\Domain\Moderation\AutoChecks\ListingAutoChecks;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use LogicException;

/**
 * «Опубликовать» (UC-L1 п. 7): содержимое формы → блокирующие автопроверки → черновик → фото → лимит → publish.
 *
 * Порядок защищает продавца от потери данных: содержимое записывается в черновик до проверок фото и лимита, поэтому
 * отказ по ним оставляет черновик заполненным; контакты в тексте отклоняются до записи (в черновик они не попадают
 * через эту форму, но автосохранение их не блокирует — публикацию блокирует validate()).
 *
 * Идемпотентность: повторный вызов для уже опубликованного (двойной клик, повтор после обрыва) ничего не меняет и
 * возвращает объявление как есть. Лимит и переход выполняются в одной транзакции под блокировкой строки пользователя:
 * две параллельные публикации не превысят лимит, а статус по-прежнему меняет только ListingStateMachine.
 */
final class PublishListing
{
    public function __construct(
        private readonly SaveListingDraft $save,
        private readonly ListingAutoChecks $checks,
        private readonly ListingStateMachine $machine,
    ) {}

    /**
     * @param  array{category_id: int, title: string, model_id?: int|null, year?: int|null, serial?: string|null, condition: string, description?: string|null, price: int|null, negotiable: bool, meet: bool, ship: bool}  $content
     *
     * @throws ValidationException блокирующая автопроверка (контакты в названии или описании)
     * @throws PhotoRequirementsNotMet не хватает фото или фото серийного номера
     * @throws ListingLimitReached достигнут лимит активных объявлений
     * @throws SuggestionLimitReached суточный лимит предложений моделей
     */
    public function __invoke(Listing $listing, array $content, ?int $cityId): Listing
    {
        if ($this->leftDraft($listing)) {
            return $listing->refresh();
        }

        $this->validate($content);

        try {
            ($this->save)($listing, $content, $cityId);
        } catch (LogicException $e) {
            // Между проверкой и записью другой запрос успел опубликовать: это та же публикация.
            if ($this->leftDraft($listing)) {
                return $listing->refresh();
            }

            throw $e;
        }

        return DB::transaction(function () use ($listing): Listing {
            User::query()->whereKey($listing->user_id)->lockForUpdate()->firstOrFail();
            $fresh = Listing::query()->whereKey($listing->getKey())->lockForUpdate()->firstOrFail();

            if ($fresh->status !== ListingStatus::Draft) {
                return $listing->refresh();
            }

            PhotoRequirements::assertSatisfied($fresh);
            ActiveListingLimit::assertAvailable($fresh->user);

            // Форма отработала: режим цены черновика больше не нужен, у объявления он вычисляется из price.
            $fresh->draft_price_mode = null;
            $fresh->save();

            return $this->machine->publish($listing);
        });
    }

    /**
     * Название и описание — блокирующие проверки 5.1.1 (контакты); ошибки приходят по полям, как у Form Request.
     *
     * @param  array<string, mixed>  $content
     */
    private function validate(array $content): void
    {
        $text = fn (string $key): ?string => isset($content[$key]) && is_string($content[$key]) ? $content[$key] : null;
        $errors = $this->checks->validate(new Listing(['title' => $text('title'), 'description' => $text('description')]))->errors();

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    /** Объявление уже не черновик: публикация состоялась (или идёт в соседнем запросе). */
    private function leftDraft(Listing $listing): bool
    {
        return ! Listing::query()
            ->whereKey($listing->getKey())
            ->where('status', ListingStatus::Draft->value)
            ->exists();
    }
}
