<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Actions\SendMessage;
use App\Domain\Messaging\Models\Conversation;
use App\Domain\Notifications\Mail\NewMessageMail;
use App\Domain\Notifications\Presence;
use Illuminate\Support\Facades\Mail;
use Tests\Support\MessagingFixtures;

// 4.4.1: письмо о новом сообщении — не чаще раза в 15 минут на чат, только если собеседник не в сети и не отключил письма.

beforeEach(function () {
    config(['scout.driver' => 'null']);
    Mail::fake();
});

function sendTo(Conversation $conversation, User $from, string $text = 'Привет'): void
{
    app(SendMessage::class)->handle($from, $conversation, $text);
}

it('получатель не в сети — получает письмо', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    $seller = User::query()->findOrFail($conversation->seller_id);

    sendTo($conversation, $buyer);

    Mail::assertSent(NewMessageMail::class, fn (NewMessageMail $m): bool => $m->hasTo($seller->email) && ! $m->hasTo($buyer->email));
});

it('получатель в сети — письма нет', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    Presence::touch(User::query()->findOrFail($conversation->seller_id));

    sendTo($conversation, $buyer);

    Mail::assertNothingSent();
});

it('письма выключены в настройках — письма нет', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    User::query()->findOrFail($conversation->seller_id)->forceFill(['notification_prefs' => ['new_message' => false]])->save();

    sendTo($conversation, $buyer);

    Mail::assertNothingSent();
});

it('не чаще раза в 15 минут на чат', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);

    sendTo($conversation, $buyer, 'Раз');
    sendTo($conversation, $buyer, 'Два');
    Mail::assertSentCount(1);

    $this->travel(16)->minutes();
    sendTo($conversation, $buyer, 'Три');
    Mail::assertSentCount(2);
});

it('частота считается отдельно по каждому чату', function () {
    $buyer = User::factory()->create();
    $first = MessagingFixtures::conversation(null, $buyer);
    $second = MessagingFixtures::conversation(null, $buyer);

    sendTo($first, $buyer);
    sendTo($second, $buyer);

    Mail::assertSentCount(2);
});

it('присутствие истекает', function () {
    $user = User::factory()->create();
    Presence::touch($user);
    expect(Presence::isOnline($user))->toBeTrue();

    $this->travel(6)->minutes();

    expect(Presence::isOnline($user))->toBeFalse();
});

it('запрос авторизованного пользователя отмечает его «в сети»', function () {
    $user = User::factory()->create();
    expect(Presence::isOnline($user))->toBeFalse();

    $this->actingAs($user)->get('/')->assertOk();

    expect(Presence::isOnline($user))->toBeTrue();
});

it('метка пишется не чаще раза в минуту, но активный пользователь остаётся в сети', function () {
    $user = User::factory()->create();
    Presence::touch($user);

    // Повторный touch в пределах минуты не продлевает метку: через 5 мин 10 с она истекает.
    $this->travel(30)->seconds();
    Presence::touch($user);
    $this->travel(280)->seconds();
    expect(Presence::isOnline($user))->toBeFalse();

    // Touch старше минуты продлевает.
    Presence::touch($user);
    $this->travel(61)->seconds();
    Presence::touch($user);
    $this->travel(4)->minutes();
    expect(Presence::isOnline($user))->toBeTrue();
});
