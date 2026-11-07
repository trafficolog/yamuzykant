<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Events;

use App\Domain\Messaging\Queries\UnreadMessages;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Счётчик непрочитанных пользователя изменился → канал `private-user.{id}`, событие `.unread.changed`.
 * Число считается при трансляции (в очереди), поэтому всегда свежее; в канал беседы оно не уходит —
 * собеседник не видит чужой счётчик.
 */
final class UnreadCountChanged implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(public readonly int $userId) {}

    /** @return list<PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.$this->userId)];
    }

    public function broadcastAs(): string
    {
        return 'unread.changed';
    }

    /** @return array{unread: int} */
    public function broadcastWith(): array
    {
        return ['unread' => app(UnreadMessages::class)->countFor($this->userId)];
    }
}
