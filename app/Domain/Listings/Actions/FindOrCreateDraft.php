<?php

declare(strict_types=1);

namespace App\Domain\Listings\Actions;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;

/**
 * Черновик продавца для формы «Продать инструмент»: последний изменённый или новый пустой.
 * Черновик нужен до отправки формы: фото загружаются к объявлению сразу (2.1.2).
 */
final class FindOrCreateDraft
{
    public function __invoke(User $user): Listing
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
