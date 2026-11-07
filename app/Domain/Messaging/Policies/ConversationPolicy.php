<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Policies;

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Models\Conversation;

/**
 * Права на беседу: только два участника — читать, писать, отмечать прочитанным и слушать канал
 * `private-conversation.{id}`. Сотрудники переписку не видят (разбор жалоб на сообщения — G2, UC-D4).
 * Можно ли ещё писать (объявление опубликовано, собеседник не удалился), решает SendMessage.
 */
final class ConversationPolicy
{
    public function view(User $user, Conversation $conversation): bool
    {
        return $conversation->isParticipant($user);
    }
}
