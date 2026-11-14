<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Events;

use App\Domain\Messaging\Models\Message;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Сообщение подозрительное (4.1.3) → плашка «Будьте осторожны» только у получателя: событие уходит в его
 * канал `private-user.{id}`, а не в канал беседы, где его увидел бы отправитель. Полезная нагрузка — только id,
 * без текста и признаков; в задании очереди — id сообщения (SerializesModels).
 */
final class MessageCautioned implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, SerializesModels;

    public function __construct(public readonly Message $message, public readonly int $recipientId) {}

    /** @return list<PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.$this->recipientId)];
    }

    public function broadcastAs(): string
    {
        return 'message.cautioned';
    }

    /** @return array{conversation_id: string, message_id: int} */
    public function broadcastWith(): array
    {
        return ['conversation_id' => $this->message->conversation_id, 'message_id' => $this->message->id];
    }
}
