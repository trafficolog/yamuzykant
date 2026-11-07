<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Actions;

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Events\ConversationRead;
use App\Domain\Messaging\Events\UnreadCountChanged;
use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Queries\UnreadMessages;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

/**
 * Участник открыл беседу: сообщения собеседника отмечаются прочитанными. Если что-то изменилось —
 * «прочитано» второй стороне и новый счётчик самому читателю (другие вкладки), после commit.
 */
final class MarkConversationRead
{
    /**
     * @return int сколько сообщений отмечено
     *
     * @throws AuthorizationException $reader не участник беседы
     */
    public function handle(User $reader, Conversation $conversation): int
    {
        if (! $conversation->isParticipant($reader)) {
            throw new AuthorizationException;
        }

        return DB::transaction(function () use ($reader, $conversation): int {
            $readAt = now();
            $marked = UnreadMessages::query($reader->id, $conversation->id)->update(['read_at' => $readAt]);

            if ($marked > 0) {
                ConversationRead::dispatch($conversation->id, $reader->id, $readAt);
                UnreadCountChanged::dispatch($reader->id);
            }

            return $marked;
        });
    }
}
