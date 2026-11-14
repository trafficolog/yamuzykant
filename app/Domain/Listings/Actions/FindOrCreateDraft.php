<?php

declare(strict_types=1);

namespace App\Domain\Listings\Actions;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Черновик продавца для формы «Продать инструмент»: последний изменённый или новый пустой.
 * Черновик нужен до отправки формы: фото загружаются к объявлению сразу (2.1.2).
 *
 * Без гонки: поиск и создание идут под блокировкой строки пользователя, поэтому две вкладки, открытые одновременно,
 * не создадут два черновика (параллельный вызов ждёт и находит уже созданный). Гарантия — на уровне БД: частичный
 * уникальный индекс listings_one_draft_per_user; если вставку всё же отклонили (черновик создан мимо этого действия),
 * действие находит существующий.
 */
final class FindOrCreateDraft
{
    public function __invoke(User $user): Listing
    {
        try {
            return DB::transaction(function () use ($user): Listing {
                User::query()->whereKey($user->id)->lockForUpdate()->first();

                return $this->find($user) ?? $this->create($user);
            });
        } catch (UniqueConstraintViolationException $e) {
            return $this->find($user) ?? throw $e;
        }
    }

    private function find(User $user): ?Listing
    {
        return Listing::query()
            ->where('user_id', $user->id)
            ->where('status', ListingStatus::Draft->value)
            ->latest('updated_at')
            ->first();
    }

    private function create(User $user): Listing
    {
        $draft = new Listing;
        $draft->user_id = $user->id;
        $draft->save();

        return $draft;
    }
}
