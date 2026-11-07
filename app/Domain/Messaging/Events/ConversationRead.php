<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Support\Carbon;

/**
 * Участник прочитал беседу → канал `private-conversation.{id}`, событие `.conversation.read`:
 * вторая сторона видит «прочитано» без перезагрузки.
 */
final class ConversationRead implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public readonly string $conversationId,
        public readonly int $readerId,
        public readonly Carbon $readAt,
    ) {}

    /** @return list<PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('conversation.'.$this->conversationId)];
    }

    public function broadcastAs(): string
    {
        return 'conversation.read';
    }

    /** @return array{conversation_id: string, reader_id: int, read_at: string} */
    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'reader_id' => $this->readerId,
            'read_at' => $this->readAt->toIso8601ZuluString(),
        ];
    }
}
