<?php

declare(strict_types=1);

namespace App\Http\Resources\Messaging;

use App\Domain\Messaging\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Сообщение для участника беседы: явный список полей. `body` — обычный текст; экранирует отображение
 * (React-текст, без dangerouslySetInnerHTML).
 *
 * @mixin Message
 */
final class MessageResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var Message $message */
        $message = $this->resource;

        return [
            ...$message->broadcastPayload(),
            'mine' => $message->sender_id !== null && $message->sender_id === $request->user()?->getAuthIdentifier(),
            'read_at' => $message->read_at?->toIso8601ZuluString(),
        ];
    }
}
