<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Messaging\Actions\SendMessage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\MessagingFixtures;

// 1.1.3: «Обзор» кабинета — блоки «Покупаю» и «Продаю»; наполняются тем, что уже есть (сообщения, объявления).

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('пустой кабинет: нули в обоих блоках', function () {
    $this->actingAs(User::factory()->create(['name' => 'Анна']))->get('/account')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Account/Overview')
            ->where('buying.unread_chats', 0)
            ->where('selling.active_listings', 0)
            ->where('selling.unread_chats', 0));
});

it('непрочитанные считаются раздельно: по чужим объявлениям — «Покупаю», по своим — «Продаю»', function () {
    $me = User::factory()->create();

    // Я покупаю: продавец написал мне два сообщения.
    $asBuyer = MessagingFixtures::conversation(null, $me);
    $seller = User::query()->findOrFail($asBuyer->seller_id);
    app(SendMessage::class)->handle($seller, $asBuyer, 'Первое');
    app(SendMessage::class)->handle($seller, $asBuyer, 'Второе');

    // Я продаю: покупатель написал одно.
    $mine = Listing::factory()->inStatus(ListingStatus::Published)->create(['user_id' => $me->id]);
    Listing::factory()->inStatus(ListingStatus::Withdrawn)->create(['user_id' => $me->id]);
    $asSeller = MessagingFixtures::conversation($mine);
    app(SendMessage::class)->handle(User::query()->findOrFail($asSeller->buyer_id), $asSeller, 'Вопрос');

    $this->actingAs($me)->get('/account')->assertInertia(fn (Assert $page) => $page
        ->where('buying.unread_chats', 2)
        ->where('selling.unread_chats', 1)
        ->where('selling.active_listings', 1));
});

it('чужие объявления и чужие беседы в счётчики не попадают', function () {
    $me = User::factory()->create();
    Listing::factory()->inStatus(ListingStatus::Published)->create();
    $other = MessagingFixtures::conversation();
    app(SendMessage::class)->handle(User::query()->findOrFail($other->seller_id), $other, 'Не мне');

    $this->actingAs($me)->get('/account')->assertInertia(fn (Assert $page) => $page
        ->where('buying.unread_chats', 0)
        ->where('selling.active_listings', 0)
        ->where('selling.unread_chats', 0));
});
