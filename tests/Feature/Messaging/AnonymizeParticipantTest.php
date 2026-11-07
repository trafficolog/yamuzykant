<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Actions\AnonymizeParticipant;
use App\Domain\Messaging\Actions\SendMessage;
use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Models\Message;
use Tests\Support\MessagingFixtures;

// BR-09: удаление аккаунта обезличивает сообщения, а не удаляет их у собеседника.

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('обезличивание убирает автора, но оставляет переписку собеседнику', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    $seller = User::query()->findOrFail($conversation->seller_id);
    app(SendMessage::class)->handle($buyer, $conversation, 'Вопрос покупателя');
    app(SendMessage::class)->handle($seller, $conversation, 'Ответ продавца');

    app(AnonymizeParticipant::class)->handle($buyer);

    $conversation->refresh();
    expect($conversation->buyer_id)->toBeNull()
        ->and($conversation->seller_id)->toBe($seller->id)
        ->and(Message::query()->count())->toBe(2)
        ->and(Message::query()->where('body', 'Вопрос покупателя')->sole()->sender_id)->toBeNull();

    $this->actingAs($seller)
        ->getJson("/conversations/{$conversation->id}/messages")
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.body', 'Вопрос покупателя')
        ->assertJsonPath('data.0.sender_id', null)
        ->assertJsonPath('data.0.mine', false)
        ->assertJsonPath('conversation.counterpart.name', 'Пользователь удалил аккаунт')
        ->assertJsonPath('conversation.counterpart.deleted', true);
});

it('удаление строки пользователя тоже обезличивает, а не удаляет переписку (внешние ключи)', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    app(SendMessage::class)->handle($buyer, $conversation, 'Останусь у продавца');

    $buyer->delete();

    expect(Conversation::query()->sole()->buyer_id)->toBeNull()
        ->and(Message::query()->sole()->sender_id)->toBeNull()
        ->and(Message::query()->sole()->body)->toBe('Останусь у продавца');
});

it('обезличенный пользователь не участвует в беседе, даже если id снова совпадёт с кем-то', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);

    app(AnonymizeParticipant::class)->handle($buyer);

    expect($conversation->refresh()->isParticipant($buyer))->toBeFalse();
});
