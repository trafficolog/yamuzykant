<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Queries;

use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Models\Message;
use Illuminate\Database\Eloquent\Collection;

/**
 * История беседы страницами: последние сообщения, курсор `before` — id самого старого показанного.
 * Курсор применяется только внутри беседы: чужие id ничего не открывают.
 */
final class ConversationHistory
{
    /** @return array{messages: Collection<int, Message>, has_more: bool} сообщения от старых к новым */
    public function page(Conversation $conversation, ?int $before = null, ?int $limit = null): array
    {
        $limit ??= max(1, (int) config('messaging.page_size'));

        $rows = Message::query()
            ->where('conversation_id', $conversation->id)
            ->when($before !== null, fn ($query) => $query->where('id', '<', $before))
            ->orderByDesc('id')
            ->limit($limit + 1)
            ->get();

        return [
            'messages' => $rows->take($limit)->reverse()->values(),
            'has_more' => $rows->count() > $limit,
        ];
    }
}
