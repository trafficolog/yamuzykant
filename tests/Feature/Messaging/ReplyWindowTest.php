<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use App\Domain\Messaging\Models\Message;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
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

it('без unpublished_at у не-published объявления окно закрыто: 409, а не отсчёт от updated_at', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Withdrawn)->create(['unpublished_at' => null]);
    $conversation = MessagingFixtures::conversation($listing);
    $buyer = User::query()->findOrFail($conversation->buyer_id);

    $this->actingAs($buyer)->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Алло'])->assertConflict();
});

it('граница окна: 30 дней минус секунда — можно, ровно 30 дней — уже нельзя', function () {
    $this->freezeSecond();

    foreach ([[now()->subDays(30)->addSecond(), 201], [now()->subDays(30), 409]] as [$since, $status]) {
        $conversation = MessagingFixtures::conversation(MessagingFixtures::listing(ListingStatus::Withdrawn, $since));
        $buyer = User::query()->findOrFail($conversation->buyer_id);

        $this->actingAs($buyer)->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Алло'])->assertStatus($status);
    }
});

it('отклонённое модерацией объявление закрывает ответы сразу, без окна', function () {
    $conversation = MessagingFixtures::conversation(MessagingFixtures::listing(ListingStatus::Rejected, now()->subDay()));
    $buyer = User::query()->findOrFail($conversation->buyer_id);

    $this->actingAs($buyer)->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Алло'])
        ->assertConflict()
        ->assertJsonPath('message', 'Объявление снято модерацией — беседа доступна только для чтения.');
    $this->getJson("/conversations/{$conversation->id}/messages")->assertOk();
});

it('снято с причиной «модерация» — ответы закрыты сразу; другие причины — окно', function (WithdrawReason $reason, bool $closed) {
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create();
    $conversation = MessagingFixtures::conversation($listing);
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    app(ListingStateMachine::class)->withdraw($listing, $reason);

    $response = $this->actingAs($buyer)->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Алло']);

    if ($closed) {
        $response->assertConflict()->assertJsonPath('message', 'Объявление снято модерацией — беседа доступна только для чтения.');
    } else {
        $response->assertCreated();
    }
})->with([
    'модерация' => [WithdrawReason::Moderation, true],
    'передумал' => [WithdrawReason::ChangedMind, false],
    'продал здесь' => [WithdrawReason::SoldHere, false],
]);

it('unpublished_at вне ListingStateMachine не пишется: LogicException', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Withdrawn)->create();
    $listing->unpublished_at = now()->addYear();

    expect(fn () => $listing->save())->toThrow(LogicException::class);
});

it('миграция заполняет unpublished_at только тем, что было опубликовано', function () {
    $withdrawn = Listing::factory()->inStatus(ListingStatus::Withdrawn)->create();
    $expired = Listing::factory()->inStatus(ListingStatus::Expired)->create();
    $published = Listing::factory()->inStatus(ListingStatus::Published)->create();
    $rejected = Listing::factory()->inStatus(ListingStatus::Rejected)->create();
    DB::table('listings')->update(['updated_at' => '2026-10-01 12:00:00']);

    $migration = require database_path('migrations/2026_11_07_120000_add_unpublished_at_to_listings_table.php');
    $migration->down();
    $migration->up();

    $at = fn (Listing $listing): ?string => ($value = DB::table('listings')->where('id', $listing->id)->value('unpublished_at')) === null
        ? null
        : Carbon::parse((string) $value)->format('Y-m-d H:i:s');
    expect($at($withdrawn))->toBe('2026-10-01 12:00:00')
        ->and($at($expired))->toBe('2026-10-01 12:00:00')
        ->and($at($published))->toBeNull()
        ->and($at($rejected))->toBeNull();
});
