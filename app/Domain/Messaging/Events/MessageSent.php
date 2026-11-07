<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Events;

use App\Domain\Messaging\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Новое сообщение в беседе → канал `private-conversation.{id}`, событие `.message.sent`.
 * Трансляция — в очереди и только после commit. В задании очереди — только id сообщения
 * (SerializesModels): текст не лежит в Redis и в failed_jobs.
 */
final class MessageSent implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly Message $message) {}

    /** @return list<PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('conversation.'.$this->message->conversation_id)];
    }

    public function broadcastAs(): string
    {
        return 'message.sent';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return $this->message->broadcastPayload();
    }
}
