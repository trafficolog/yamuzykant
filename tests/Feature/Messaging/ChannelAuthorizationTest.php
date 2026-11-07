<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Support\MessagingFixtures;

// 4.1.1: каналы private-conversation.{id} и private-user.{id}; авторизация — только участникам (Policy).

beforeEach(function () {
    config(['scout.driver' => 'null']);
    MessagingFixtures::useReverbBroadcaster();
});

function authorizeChannel(string $channel): TestResponse
{
    return currentTest()->postJson('/broadcasting/auth', [
        'socket_id' => '1234.5678',
        'channel_name' => $channel,
    ]);
}

it('покупатель и продавец подписываются на канал своей беседы', function () {
    $conversation = MessagingFixtures::conversation();

    foreach ([$conversation->buyer_id, $conversation->seller_id] as $id) {
        $this->actingAs(User::query()->findOrFail($id));

        authorizeChannel("private-conversation.{$conversation->id}")
            ->assertOk()
            ->assertJsonPath('auth', fn (string $auth): bool => str_starts_with($auth, 'test-key:'));
    }
});

it('третье лицо не может подписаться на чужую беседу: 403', function () {
    $conversation = MessagingFixtures::conversation();

    $this->actingAs(User::factory()->create());

    authorizeChannel("private-conversation.{$conversation->id}")->assertForbidden();
});

it('гость не может подписаться ни на беседу, ни на канал пользователя: 403', function () {
    $conversation = MessagingFixtures::conversation();

    authorizeChannel("private-conversation.{$conversation->id}")->assertForbidden();
    authorizeChannel("private-user.{$conversation->buyer_id}")->assertForbidden();
});

it('несуществующая беседа — отказ, а не подписка', function () {
    $this->actingAs(User::factory()->create());

    authorizeChannel('private-conversation.'.Str::uuid()->toString())->assertForbidden();
    expect(authorizeChannel('private-conversation.not-a-uuid')->status())->toBeIn([403, 404]);
});

it('канал пользователя — только свой', function () {
    $me = User::factory()->create();
    $other = User::factory()->create();

    $this->actingAs($me);

    authorizeChannel("private-user.{$me->id}")->assertOk();
    authorizeChannel("private-user.{$other->id}")->assertForbidden();
});

it('собеседник, удаливший аккаунт, не открывает канал заново: участник определяется по id в беседе', function () {
    $conversation = MessagingFixtures::conversation();
    $conversation->buyer_id = null;
    $conversation->save();

    $this->actingAs(User::factory()->create());

    authorizeChannel("private-conversation.{$conversation->id}")->assertForbidden();
});

it('авторизация каналов ограничена по частоте', function () {
    $me = User::factory()->create();
    $this->actingAs($me);

    $statuses = collect(range(1, 121))->map(fn (): int => authorizeChannel("private-user.{$me->id}")->status());

    expect($statuses->last())->toBe(429);
});
