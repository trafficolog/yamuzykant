<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Events\MessageSent;
use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Models\Message;
use Illuminate\Support\Facades\Event;
use Tests\Support\MessagingFixtures;

// 4.1.3 (ревью PR #128): ключ идемпотентности отправки — client_id от клиента, уникальный в беседе.
// «Повторить» после потерянного ответа не создаёт дубль.

const CLIENT_A = '7c1f5f0e-2b0e-4f0b-9a58-0c1d8f1e2a11';
const CLIENT_B = '0b9d3a6e-6f4a-4c1e-8a54-3e5b7c9d1f22';

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('повтор отправки с тем же client_id возвращает то же сообщение и не создаёт дубль', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    $this->actingAs($buyer);
    Event::fake([MessageSent::class]);

    $first = $this->postJson("/conversations/{$conversation->id}/messages", ['body' => 'ок', 'client_id' => CLIENT_A])
        ->assertCreated()
        ->assertJsonPath('data.client_id', CLIENT_A);

    $second = $this->postJson("/conversations/{$conversation->id}/messages", ['body' => 'ок', 'client_id' => CLIENT_A])
        ->assertOk()
        ->assertJsonPath('data.client_id', CLIENT_A);

    expect($second->json('data.id'))->toBe($first->json('data.id'))
        ->and(Message::query()->count())->toBe(1);
    // Событие realtime — один раз: повтор не рассылает дубль собеседнику.
    Event::assertDispatchedTimes(MessageSent::class, 1);
});

it('два одинаковых по тексту сообщения с разными client_id — два сообщения', function () {
    $conversation = MessagingFixtures::conversation();
    $this->actingAs(User::query()->findOrFail($conversation->buyer_id));

    $this->postJson("/conversations/{$conversation->id}/messages", ['body' => 'ок', 'client_id' => CLIENT_A])->assertCreated();
    $this->postJson("/conversations/{$conversation->id}/messages", ['body' => 'ок', 'client_id' => CLIENT_B])->assertCreated();

    expect(Message::query()->count())->toBe(2);
});

it('сообщения без client_id по-прежнему принимаются (ключ необязателен)', function () {
    $conversation = MessagingFixtures::conversation();
    $this->actingAs(User::query()->findOrFail($conversation->buyer_id));

    $this->postJson("/conversations/{$conversation->id}/messages", ['body' => 'ок'])->assertCreated()->assertJsonPath('data.client_id', null);
    $this->postJson("/conversations/{$conversation->id}/messages", ['body' => 'ок'])->assertCreated();

    expect(Message::query()->count())->toBe(2);
});

it('один client_id в разных беседах и у разных авторов не конфликтует', function () {
    $first = MessagingFixtures::conversation();
    $second = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($first->buyer_id);
    $seller = User::query()->findOrFail($first->seller_id);

    $this->actingAs($buyer)->postJson("/conversations/{$first->id}/messages", ['body' => 'раз', 'client_id' => CLIENT_A])->assertCreated();
    $this->actingAs($seller)->postJson("/conversations/{$first->id}/messages", ['body' => 'два', 'client_id' => CLIENT_A])->assertCreated();
    $this->actingAs(User::query()->findOrFail($second->buyer_id))
        ->postJson("/conversations/{$second->id}/messages", ['body' => 'три', 'client_id' => CLIENT_A])->assertCreated();

    expect(Message::query()->count())->toBe(3);
});

it('«Написать продавцу» с повтором после потерянного ответа: одна беседа, одно сообщение', function () {
    $listing = MessagingFixtures::listing();
    $this->actingAs(User::factory()->create());
    Event::fake([MessageSent::class]);

    $first = $this->postJson("/listings/{$listing->id}/conversations", ['body' => 'Здравствуйте', 'client_id' => CLIENT_A])->assertCreated();
    $second = $this->postJson("/listings/{$listing->id}/conversations", ['body' => 'Здравствуйте', 'client_id' => CLIENT_A])->assertOk();

    expect($second->json('message.id'))->toBe($first->json('message.id'))
        ->and($second->json('conversation.id'))->toBe($first->json('conversation.id'))
        ->and(Conversation::query()->count())->toBe(1)
        ->and(Message::query()->count())->toBe(1);
    Event::assertDispatchedTimes(MessageSent::class, 1);
});

it('повтор не тратит суточный лимит новых чатов', function () {
    config(['messaging.new_chats_per_day' => 1]);
    $listing = MessagingFixtures::listing();
    $this->actingAs(User::factory()->create());

    $this->postJson("/listings/{$listing->id}/conversations", ['body' => 'Здравствуйте', 'client_id' => CLIENT_A])->assertCreated();
    $this->postJson("/listings/{$listing->id}/conversations", ['body' => 'Здравствуйте', 'client_id' => CLIENT_A])->assertOk();
});

it('client_id попадает в сообщение realtime, чтобы клиент сопоставлял эхо с отправкой', function () {
    $conversation = MessagingFixtures::conversation();
    $this->actingAs(User::query()->findOrFail($conversation->buyer_id));

    $this->postJson("/conversations/{$conversation->id}/messages", ['body' => 'ок', 'client_id' => CLIENT_A])->assertCreated();

    expect(Message::query()->sole()->broadcastPayload()['client_id'])->toBe(CLIENT_A);
});

it('некорректный client_id отклоняется: 422', function (mixed $clientId) {
    $conversation = MessagingFixtures::conversation();
    $this->actingAs(User::query()->findOrFail($conversation->buyer_id));

    $this->postJson("/conversations/{$conversation->id}/messages", ['body' => 'ок', 'client_id' => $clientId])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('client_id');

    expect(Message::query()->count())->toBe(0);
})->with([
    'слишком длинный' => [str_repeat('a', 65)],
    'с пробелами и скобками' => ['a b<script>'],
    'не строка' => [['x']],
]);
