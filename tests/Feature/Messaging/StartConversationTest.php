<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Models\Message;
use Illuminate\Support\Str;
use Tests\Support\MessagingFixtures;

// UC-D1 «Написать продавцу»: первое сообщение создаёт беседу (listing_id, buyer_id, seller_id — уникально).

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('покупатель пишет по опубликованному объявлению: создаётся беседа и первое сообщение', function () {
    $listing = MessagingFixtures::listing();
    $buyer = User::factory()->create(['name' => 'Анна']);

    $response = $this->actingAs($buyer)
        ->postJson("/listings/{$listing->id}/conversations", ['body' => 'Здравствуйте, гитара ещё продаётся?'])
        ->assertCreated()
        ->assertJsonPath('conversation.role', 'buying')
        ->assertJsonPath('conversation.listing.id', $listing->id)
        ->assertJsonPath('conversation.listing.title', 'Fender ’57 Stratocaster')
        ->assertJsonPath('conversation.counterpart.name', $listing->user->name)
        ->assertJsonPath('message.body', 'Здравствуйте, гитара ещё продаётся?')
        ->assertJsonPath('message.kind', 'text')
        ->assertJsonPath('message.mine', true);

    $conversation = Conversation::query()->sole();
    expect($conversation->listing_id)->toBe($listing->id)
        ->and($conversation->buyer_id)->toBe($buyer->id)
        ->and($conversation->seller_id)->toBe($listing->user_id)
        ->and($conversation->last_message_at)->not->toBeNull()
        ->and($response->json('conversation.id'))->toBe($conversation->id);

    $message = Message::query()->sole();
    expect($message->sender_id)->toBe($buyer->id)
        ->and($message->read_at)->toBeNull();
});

it('повторное «Написать» по тому же объявлению продолжает ту же беседу', function () {
    $listing = MessagingFixtures::listing();
    $buyer = User::factory()->create();

    $first = $this->actingAs($buyer)->postJson("/listings/{$listing->id}/conversations", ['body' => 'Первое'])->assertCreated();
    $second = $this->postJson("/listings/{$listing->id}/conversations", ['body' => 'Второе'])->assertCreated();

    expect($second->json('conversation.id'))->toBe($first->json('conversation.id'))
        ->and(Conversation::query()->count())->toBe(1)
        ->and(Message::query()->count())->toBe(2);
});

it('продавец не может начать чат с самим собой', function () {
    $listing = MessagingFixtures::listing();

    $this->actingAs($listing->user)
        ->postJson("/listings/{$listing->id}/conversations", ['body' => 'Привет себе'])
        ->assertForbidden()
        ->assertJsonPath('message', 'Это ваше объявление — написать самому себе нельзя.');

    expect(Conversation::query()->count())->toBe(0)
        ->and(Message::query()->count())->toBe(0);
});

it('по объявлению не в published написать нельзя: 404, как у отсутствующего (SPEC §6.1)', function (ListingStatus $status) {
    $listing = MessagingFixtures::listing($status);

    $this->actingAs(User::factory()->create())
        ->postJson("/listings/{$listing->id}/conversations", ['body' => 'Здравствуйте'])
        ->assertNotFound();

    expect(Conversation::query()->count())->toBe(0);
})->with([
    ListingStatus::Draft,
    ListingStatus::Pending,
    ListingStatus::NeedsChanges,
    ListingStatus::Rejected,
    ListingStatus::Withdrawn,
    ListingStatus::Expired,
]);

it('несуществующее объявление — 404', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/listings/'.Str::uuid()->toString().'/conversations', ['body' => 'Здравствуйте'])
        ->assertNotFound();
});

it('гостю написать нельзя: 401', function () {
    $listing = MessagingFixtures::listing();

    $this->postJson("/listings/{$listing->id}/conversations", ['body' => 'Здравствуйте'])->assertUnauthorized();

    expect(Conversation::query()->count())->toBe(0);
});

it('пустое и слишком длинное сообщение — 422 с понятным текстом', function () {
    $listing = MessagingFixtures::listing();
    $this->actingAs(User::factory()->create());

    $this->postJson("/listings/{$listing->id}/conversations", ['body' => "  \n\t "])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['body' => 'Напишите сообщение.']);

    $this->postJson("/listings/{$listing->id}/conversations", ['body' => str_repeat('а', 2001)])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['body' => 'Сообщение длиннее 2000 символов — сократите его.']);

    $this->postJson("/listings/{$listing->id}/conversations", ['body' => ['массив']])
        ->assertUnprocessable();

    expect(Conversation::query()->count())->toBe(0);
});

it('почта продавца и покупателя не уходит в ответ (BR-04)', function () {
    $listing = MessagingFixtures::listing();
    $buyer = User::factory()->create(['email' => 'buyer-secret@example.test']);
    $listing->user->forceFill(['email' => 'seller-secret@example.test'])->save();

    $content = $this->actingAs($buyer)
        ->postJson("/listings/{$listing->id}/conversations", ['body' => 'Здравствуйте'])
        ->assertCreated()
        ->getContent();

    expect($content)->not->toContain('secret@example.test')
        ->and($content)->not->toContain('yandex_id')
        ->and($content)->not->toContain('V091234');
});
