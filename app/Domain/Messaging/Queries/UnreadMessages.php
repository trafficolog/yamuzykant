<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Queries;

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Enums\MessageKind;
use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Models\Message;
use Illuminate\Database\Eloquent\Builder;

/**
 * Непрочитанные сообщения пользователя: в его беседах, от собеседника (в т. ч. удалившего аккаунт),
 * без системных строк. Счётчик шапки (shared prop `messages.unread`) и события `unread.changed`.
 */
final class UnreadMessages
{
    public function count(User $user): int
    {
        return $this->countFor($user->id);
    }

    public function countFor(int $userId): int
    {
        return self::query($userId)->count();
    }

    /**
     * Непрочитанные для $userId; $conversationId сужает до одной беседы.
     *
     * @return Builder<Message>
     */
    public static function query(int $userId, ?string $conversationId = null): Builder
    {
        return Message::query()
            ->whereNull('read_at')
            ->where('kind', '!=', MessageKind::System->value)
            ->where(fn (Builder $q) => $q->whereNull('sender_id')->orWhere('sender_id', '!=', $userId))
            ->when(
                $conversationId !== null,
                fn (Builder $q) => $q->where('conversation_id', $conversationId),
                fn (Builder $q) => $q->whereIn('conversation_id', Conversation::query()
                    ->select('id')
                    ->where(fn (Builder $c) => $c->where('buyer_id', $userId)->orWhere('seller_id', $userId))),
            );
    }
}
