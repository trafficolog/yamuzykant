<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Queries;

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Models\Message;
use Illuminate\Database\Eloquent\Collection;

/**
 * Беседы пользователя для списка экрана сообщений: свежие сверху, не больше `messaging.list_limit`.
 * К каждой беседе подкладываются последнее сообщение (relation `lastMessage`) и число непрочитанных
 * (атрибут `unread_count`) — двумя запросами на весь список, а не по запросу на беседу.
 */
final class UserConversations
{
    /** @return Collection<int, Conversation> */
    public function for(User $user, ?int $limit = null): Collection
    {
        $limit ??= max(1, (int) config('messaging.list_limit'));

        /** @var Collection<int, Conversation> $conversations */
        $conversations = Conversation::query()
            ->where(fn ($query) => $query->where('buyer_id', $user->id)->orWhere('seller_id', $user->id))
            ->with(['listing.saleRecord', 'buyer', 'seller'])
            ->orderByRaw('last_message_at desc nulls last')
            ->orderByDesc('id')
            ->limit($limit)
            ->get();

        if ($conversations->isEmpty()) {
            return $conversations;
        }

        $ids = $conversations->modelKeys();

        $lastIds = Message::query()
            ->whereIn('conversation_id', $ids)
            ->selectRaw('max(id) as id')
            ->groupBy('conversation_id')
            ->pluck('id');
        $last = Message::query()->whereKey($lastIds->all())->get()->keyBy('conversation_id');

        $unread = UnreadMessages::query($user->id)
            ->whereIn('conversation_id', $ids)
            ->selectRaw('conversation_id, count(*) as total')
            ->groupBy('conversation_id')
            ->pluck('total', 'conversation_id');

        foreach ($conversations as $conversation) {
            $conversation->setRelation('lastMessage', $last->get($conversation->id));
            $conversation->setAttribute('unread_count', (int) ($unread->get($conversation->id) ?? 0));
        }

        return $conversations;
    }
}
