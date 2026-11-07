<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use App\Domain\Messaging\Models\Message;
use Illuminate\Testing\TestResponse;
use Symfony\Component\HttpFoundation\Response;
use Tests\Support\MessagingFixtures;
use Tests\TestCase;

// BR-10 (решение OWNER 07.11.2026): в начатой беседе отвечать можно 30 дней после ухода объявления из published;
// позже — 409, беседа только для чтения. Новые беседы — только по published.

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

/**
 * Ответ участника беседы по объявлению, ушедшему из published $days дней назад.
 *
 * @return TestResponse<Response>
 */
function replyAfter(TestCase $test, ListingStatus $status, int $days): TestResponse
{
    $conversation = MessagingFixtures::conversation(MessagingFixtures::listing($status, now()->subDays($days)));
    $buyer = User::query()->findOrFail($conversation->buyer_id);

    return $test->actingAs($buyer)->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Ещё актуально?']);
}

it('снято 29 дней назад — ответ проходит', function () {
    replyAfter($this, ListingStatus::Withdrawn, 29)->assertCreated();

    expect(Message::query()->count())->toBe(1);
});

it('снято 31 день назад — 409, сообщение не сохраняется, чтение остаётся', function () {
    $conversation = MessagingFixtures::conversation(MessagingFixtures::listing(ListingStatus::Withdrawn, now()->subDays(31)));
    $buyer = User::query()->findOrFail($conversation->buyer_id);

    $this->actingAs($buyer)->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Поздно'])->assertConflict();
    $this->getJson("/conversations/{$conversation->id}/messages")->assertOk();
    expect(Message::query()->count())->toBe(0);
});

it('истекло: те же 29 и 31 день', function () {
    replyAfter($this, ListingStatus::Expired, 29)->assertCreated();
    replyAfter($this, ListingStatus::Expired, 31)->assertConflict();
});

it('продавец отвечает по тем же правилам, что и покупатель', function () {
    $conversation = MessagingFixtures::conversation(MessagingFixtures::listing(ListingStatus::Withdrawn, now()->subDays(29)));
    $seller = User::query()->findOrFail($conversation->seller_id);

    $this->actingAs($seller)->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Да'])->assertCreated();

    $this->travel(3)->days();
    $this->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Ещё да'])->assertConflict();
});

it('срок берётся из messaging.reply_window_days', function () {
    expect(config('messaging.reply_window_days'))->toBe(30);

    config(['messaging.reply_window_days' => 5]);
    replyAfter($this, ListingStatus::Withdrawn, 4)->assertCreated();
    replyAfter($this, ListingStatus::Withdrawn, 6)->assertConflict();
});

it('опубликованное объявление: отвечать можно всегда', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);

    $this->actingAs($buyer)->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Привет'])->assertCreated();
});

it('новая беседа по снятому объявлению — 404, даже в пределах 30 дней', function () {
    $listing = MessagingFixtures::listing(ListingStatus::Withdrawn, now()->subDays(1));

    $this->actingAs(User::factory()->create())
        ->postJson("/listings/{$listing->id}/conversations", ['body' => 'Здравствуйте'])
        ->assertNotFound();
});

it('первое сообщение по другому покупателю в уже начатой беседе не обходит окно: StartConversation после 31 дня — 404', function () {
    $listing = MessagingFixtures::listing(ListingStatus::Withdrawn, now()->subDays(31));
    $conversation = MessagingFixtures::conversation($listing);
    $buyer = User::query()->findOrFail($conversation->buyer_id);

    $this->actingAs($buyer)->postJson("/listings/{$listing->id}/conversations", ['body' => 'Ещё раз'])->assertNotFound();
});

// Момент ухода из published — поле listings.unpublished_at, его ведёт ListingStateMachine.

it('снятие и истечение записывают unpublished_at; повторный переход из expired в withdrawn момент не сдвигает', function () {
    $machine = app(ListingStateMachine::class);
    $this->freezeSecond();

    $withdrawn = Listing::factory()->inStatus(ListingStatus::Published)->create();
    $machine->withdraw($withdrawn, WithdrawReason::ChangedMind);
    expect($withdrawn->refresh()->unpublished_at?->equalTo(now()))->toBeTrue();

    $expired = Listing::factory()->inStatus(ListingStatus::Published)->create();
    $machine->expire($expired);
    $expiredAt = now();
    expect($expired->refresh()->unpublished_at?->equalTo($expiredAt))->toBeTrue();

    $this->travel(10)->days();
    $machine->withdraw($expired, WithdrawReason::ChangedMind);
    expect($expired->refresh()->unpublished_at?->equalTo($expiredAt))->toBeTrue();
});

it('возврат в published сбрасывает unpublished_at', function () {
    $machine = app(ListingStateMachine::class);
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create();
    $machine->withdraw($listing, WithdrawReason::ChangedMind);
    $machine->relist($listing);

    expect($listing->refresh()->status)->toBe(ListingStatus::Published)
        ->and($listing->unpublished_at)->toBeNull();
});
