<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Queries;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Queries\UnreadMessages;

/**
 * Числа для «Обзора» кабинета, разложенные по ролям одного аккаунта: «Покупаю» — по чужим объявлениям,
 * «Продаю» — по своим. Избранное и сохранённые поиски добавят 4.3.1 и 4.3.2.
 */
final class CabinetOverview
{
    /** @return array{unread_chats: int} */
    public function buying(User $user): array
    {
        return ['unread_chats' => $this->unread($user, 'buyer_id')];
    }

    /** @return array{active_listings: int, unread_chats: int} */
    public function selling(User $user): array
    {
        return [
            'active_listings' => Listing::query()
                ->where('user_id', $user->id)
                ->where('status', ListingStatus::Published->value)
                ->count(),
            'unread_chats' => $this->unread($user, 'seller_id'),
        ];
    }

    private function unread(User $user, string $role): int
    {
        return UnreadMessages::query($user->id)
            ->whereIn('conversation_id', Conversation::query()->select('id')->where($role, $user->id))
            ->count();
    }
}
