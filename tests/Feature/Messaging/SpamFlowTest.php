<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Events\MessageSent;
use App\Domain\Messaging\Models\Message;
use App\Domain\Messaging\Models\MessageFlag;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Tests\Support\MessagingFixtures;

// 4.1.3: подозрительное сообщение доставляется с плашкой «Будьте осторожны» и попадает в очередь модерации.

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('сообщение со ссылкой от аккаунта младше 24 ч доставляется с плашкой и попадает в очередь модерации', function () {
    $newcomer = User::factory()->create();
    $conversation = MessagingFixtures::conversation(buyer: $newcomer);
    Event::fake([MessageSent::class]);

    $this->actingAs($newcomer)
        ->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Оплатите по ссылке https://example.com/pay'])
        ->assertCreated()
        // Автору плашка не показывается: она для получателя.
        ->assertJsonPath('data.caution', false);

    $message = Message::query()->sole();
    Event::assertDispatched(MessageSent::class);
    expect($message->suspicious)->toBeTrue();

    $flag = MessageFlag::query()->sole();
    expect($flag->message_id)->toBe($message->id)
        ->and($flag->signals)->toBe(['new_account_link'])
        ->and($flag->reviewed_at)->toBeNull();

    // Получатель видит плашку.
    $seller = User::query()->findOrFail($conversation->seller_id);
    $this->actingAs($seller)
        ->getJson("/conversations/{$conversation->id}/messages")
        ->assertOk()
        ->assertJsonPath('data.0.caution', true);
});

it('в сообщении realtime признак плашки есть, текст признаков и причин наружу не уходит', function () {
    $newcomer = User::factory()->create();
    $conversation = MessagingFixtures::conversation(buyer: $newcomer);
    $this->actingAs($newcomer)->postJson("/conversations/{$conversation->id}/messages", ['body' => 'https://example.com']);

    $payload = Message::query()->sole()->broadcastPayload();

    expect($payload['caution'])->toBeTrue()
        ->and($payload)->not->toHaveKey('signals');
});

it('сообщение от аккаунта старше 24 ч со ссылкой — без плашки и без очереди', function () {
    $veteran = User::factory()->create();
    $veteran->forceFill(['created_at' => now()->subHours(30)])->save();
    $conversation = MessagingFixtures::conversation(buyer: $veteran);

    $this->actingAs($veteran)
        ->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Фото: https://example.com/photo'])
        ->assertCreated();

    expect(Message::query()->sole()->suspicious)->toBeFalse()
        ->and(MessageFlag::query()->count())->toBe(0);

    $seller = User::query()->findOrFail($conversation->seller_id);
    $this->actingAs($seller)->getJson("/conversations/{$conversation->id}/messages")->assertJsonPath('data.0.caution', false);
});

it('первое сообщение нового чата проверяется так же', function () {
    $newcomer = User::factory()->create();
    $listing = MessagingFixtures::listing();

    $this->actingAs($newcomer)
        ->postJson("/listings/{$listing->id}/conversations", ['body' => 'Пишите в телеграм, там дешевле'])
        ->assertCreated();

    expect(MessageFlag::query()->sole()->signals)->toBe(['messenger_request']);
});

it('повтор отправки не создаёт вторую запись в очереди модерации', function () {
    $newcomer = User::factory()->create();
    $conversation = MessagingFixtures::conversation(buyer: $newcomer);
    $this->actingAs($newcomer);
    $payload = ['body' => 'https://example.com', 'client_id' => 'abc-123'];

    $this->postJson("/conversations/{$conversation->id}/messages", $payload)->assertCreated();
    $this->postJson("/conversations/{$conversation->id}/messages", $payload)->assertOk();

    expect(MessageFlag::query()->count())->toBe(1);
});

it('текст подозрительного сообщения не попадает в журнал', function () {
    Log::spy();
    $newcomer = User::factory()->create();
    $conversation = MessagingFixtures::conversation(buyer: $newcomer);

    $this->actingAs($newcomer)->postJson("/conversations/{$conversation->id}/messages", ['body' => 'секретный-текст https://example.com']);

    Log::shouldNotHaveReceived('warning', fn (string $message, array $context = []): bool => str_contains($message.json_encode($context), 'секретный-текст'));
    expect(MessageFlag::query()->sole()->toJson())->not->toContain('секретный-текст');
});
