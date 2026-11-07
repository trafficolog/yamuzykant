<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Actions\SendMessage;
use App\Domain\Messaging\Events\ConversationRead;
use App\Domain\Messaging\Events\UnreadCountChanged;
use App\Domain\Messaging\Models\Message;
use App\Domain\Messaging\Queries\UnreadMessages;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia;
use Tests\Support\MessagingFixtures;

// 4.1.1: счётчик непрочитанных в shared props; «прочитано» — событие ConversationRead.

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('непрочитанные считаются у получателя, а не у отправителя', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    $seller = User::query()->findOrFail($conversation->seller_id);

    app(SendMessage::class)->handle($buyer, $conversation, 'Первое');
    app(SendMessage::class)->handle($buyer, $conversation, 'Второе');
    // Вторая беседа продавца по другому покупателю.
    $other = MessagingFixtures::conversation(MessagingFixtures::listing());
    app(SendMessage::class)->handle(User::query()->findOrFail($other->buyer_id), $other, 'Чужое');

    $unread = app(UnreadMessages::class);
    expect($unread->count($seller))->toBe(2)
        ->and($unread->count($buyer))->toBe(0);
});

it('счётчик непрочитанных — в shared props вошедшего; у гостя его нет', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    $seller = User::query()->findOrFail($conversation->seller_id);
    app(SendMessage::class)->handle($buyer, $conversation, 'Здравствуйте');

    $this->actingAs($seller)->get('/')
        ->assertInertia(fn (AssertableInertia $page) => $page->where('messages.unread', 1));

    $this->actingAs($buyer)->get('/')
        ->assertInertia(fn (AssertableInertia $page) => $page->where('messages.unread', 0));

    auth()->logout();
    $this->get('/')->assertInertia(fn (AssertableInertia $page) => $page->where('messages', null));
});

it('«прочитано» обнуляет непрочитанные беседы и сообщает второй стороне', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    $seller = User::query()->findOrFail($conversation->seller_id);
    app(SendMessage::class)->handle($buyer, $conversation, 'Первое');
    app(SendMessage::class)->handle($buyer, $conversation, 'Второе');
    app(SendMessage::class)->handle($seller, $conversation, 'Ответ продавца');

    Event::fake([ConversationRead::class, UnreadCountChanged::class]);

    $this->actingAs($seller)
        ->postJson("/conversations/{$conversation->id}/read")
        ->assertOk()
        ->assertJsonPath('unread', 0);

    expect(app(UnreadMessages::class)->count($seller))->toBe(0)
        // Своё сообщение продавца остаётся непрочитанным для покупателя.
        ->and(Message::query()->where('sender_id', $seller->id)->whereNull('read_at')->count())->toBe(1);

    Event::assertDispatched(ConversationRead::class, fn (ConversationRead $event): bool => $event->conversationId === $conversation->id
        && $event->readerId === $seller->id);
    Event::assertDispatched(UnreadCountChanged::class, fn (UnreadCountChanged $event): bool => $event->userId === $seller->id);
});

it('повторное «прочитано» без новых сообщений ничего не транслирует', function () {
    $conversation = MessagingFixtures::conversation();
    $seller = User::query()->findOrFail($conversation->seller_id);
    Event::fake([ConversationRead::class, UnreadCountChanged::class]);

    $this->actingAs($seller)->postJson("/conversations/{$conversation->id}/read")->assertOk();

    Event::assertNotDispatched(ConversationRead::class);
    Event::assertNotDispatched(UnreadCountChanged::class);
});

it('гость не отмечает прочитанным: 401', function () {
    $conversation = MessagingFixtures::conversation();

    $this->postJson("/conversations/{$conversation->id}/read")->assertUnauthorized();
});
