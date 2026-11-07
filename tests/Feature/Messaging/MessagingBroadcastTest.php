<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Actions\SendMessage;
use App\Domain\Messaging\Events\ConversationRead;
use App\Domain\Messaging\Events\MessageSent;
use App\Domain\Messaging\Events\UnreadCountChanged;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Support\Carbon;
use Tests\Support\MessagingFixtures;

// 4.1.1: события Reverb — в очереди, после commit, в приватные каналы, с явным списком полей (BR-04).

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('все события сообщений транслируются в очереди и только после commit', function (string $event) {
    $interfaces = class_implements($event);

    expect($interfaces)->toHaveKey(ShouldBroadcast::class)
        ->and($interfaces)->toHaveKey(ShouldDispatchAfterCommit::class);
})->with([MessageSent::class, ConversationRead::class, UnreadCountChanged::class]);

it('MessageSent: приватный канал беседы, имя message.sent, только поля сообщения', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    $buyer->forceFill(['email' => 'hidden-buyer@example.test'])->save();
    $message = app(SendMessage::class)->handle($buyer, $conversation, 'Здравствуйте');

    $event = new MessageSent($message);
    $channels = $event->broadcastOn();

    expect($channels)->toHaveCount(1)
        ->and($channels[0])->toBeInstanceOf(PrivateChannel::class)
        ->and($channels[0]->name)->toBe("private-conversation.{$conversation->id}")
        ->and($event->broadcastAs())->toBe('message.sent');

    $payload = $event->broadcastWith();
    expect(array_keys($payload))->toBe(['id', 'conversation_id', 'kind', 'body', 'sender_id', 'created_at'])
        ->and($payload['body'])->toBe('Здравствуйте')
        ->and($payload['sender_id'])->toBe($buyer->id)
        ->and(json_encode($payload))->not->toContain('hidden-buyer');
});

it('UnreadCountChanged: канал пользователя и его текущий счётчик', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    app(SendMessage::class)->handle($buyer, $conversation, 'Раз');
    app(SendMessage::class)->handle($buyer, $conversation, 'Два');

    $event = new UnreadCountChanged((int) $conversation->seller_id);

    expect($event->broadcastOn()[0]->name)->toBe("private-user.{$conversation->seller_id}")
        ->and($event->broadcastAs())->toBe('unread.changed')
        ->and($event->broadcastWith())->toBe(['unread' => 2]);
});

it('ConversationRead: канал беседы, кто и когда прочитал', function () {
    $conversation = MessagingFixtures::conversation();
    $readAt = Carbon::parse('2026-11-07 12:00:00', 'UTC');

    $event = new ConversationRead($conversation->id, (int) $conversation->seller_id, $readAt);

    expect($event->broadcastOn()[0]->name)->toBe("private-conversation.{$conversation->id}")
        ->and($event->broadcastAs())->toBe('conversation.read')
        ->and($event->broadcastWith())->toBe([
            'conversation_id' => $conversation->id,
            'reader_id' => $conversation->seller_id,
            'read_at' => '2026-11-07T12:00:00Z',
        ]);
});
