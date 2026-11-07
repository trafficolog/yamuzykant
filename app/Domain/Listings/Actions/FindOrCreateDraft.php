<?php

declare(strict_types=1);

namespace App\Domain\Listings\Actions;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use Illuminate\Support\Facades\DB;

/**
 * Черновик продавца для формы «Продать инструмент»: последний изменённый или новый пустой.
 * Черновик нужен до отправки формы: фото загружаются к объявлению сразу (2.1.2).
 *
 * Без гонки: поиск и создание идут под блокировкой строки пользователя, поэтому две вкладки, открытые одновременно,
 * не создадут два черновика (параллельный вызов ждёт и находит уже созданный).
 */
final class FindOrCreateDraft
{
    public function __invoke(User $user): Listing
    {
        return DB::transaction(function () use ($user): Listing {
            User::query()->whereKey($user->id)->lockForUpdate()->first();

            return $this->findOrCreate($user);
        });
    }

    private function findOrCreate(User $user): Listing
    {
        $draft = Listing::query()
            ->where('user_id', $user->id)
            ->where('status', ListingStatus::Draft->value)
            ->latest('updated_at')
            ->first();

        if ($draft !== null) {
            return $draft;
        }

        $draft = new Listing;
        $draft->user_id = $user->id;
        $draft->save();

        return $draft;
    }
}
