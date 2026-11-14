<?php

declare(strict_types=1);

namespace App\Http\Resources\Messaging;

use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Строка списка бесед: данные беседы (ConversationResource), последнее сообщение для превью, число
 * непрочитанных. Нужны relation `lastMessage` и атрибут
 * `unread_count` из UserConversations. Превью обрезано: в список целиком текст не уходит.
 *
 * @mixin Conversation
 */
final class ConversationListItemResource extends JsonResource
{
    /** Длина превью последнего сообщения, символов. */
    private const PREVIEW_LENGTH = 160;

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var Conversation $conversation */
        $conversation = $this->resource;
        $last = $conversation->getRelation('lastMessage');
        $base = (new ConversationResource($conversation))->toArray($request);

        return [
            ...$base,
            'last_message' => $last instanceof Message ? [
                'body' => mb_substr($last->body, 0, self::PREVIEW_LENGTH),
                'mine' => $last->sender_id !== null && $last->sender_id === $request->user()?->getAuthIdentifier(),
                'kind' => $last->kind->value,
                'created_at' => $last->created_at->toIso8601ZuluString(),
            ] : null,
            'unread' => (int) $conversation->getAttribute('unread_count'),
        ];
    }
}
