<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Domain\Listings\Models\SaleRecord;
use App\Domain\Messaging\Actions\AnonymizeParticipant;
use App\Domain\Messaging\Actions\MarkConversationRead;
use App\Domain\Messaging\Actions\SendMessage;
use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Models\Message;
use App\Domain\Messaging\Queries\UserConversations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;
use Tests\Support\MessagingFixtures;

// 4.1.2: экран сообщений — страница Inertia `Messages/Index` со списком бесед, открытой беседой и «Написать продавцу».
// Домен и JSON-эндпоинты — 4.1.1 и 4.1.4; здесь только выдача данных странице (BR-04, BR-10).

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

function say(Conversation $conversation, User $from, string $text): Message
{
    return app(SendMessage::class)->handle($from, $conversation, $text);
}

function participant(Conversation $conversation, string $side): User
{
    return User::query()->findOrFail($side === 'buyer' ? $conversation->buyer_id : $conversation->seller_id);
}

it('гостя отправляет на главную, как остальные страницы кабинета', function () {
    $this->get('/messages')->assertRedirect('/');
    $this->get('/messages/'.Str::uuid())->assertRedirect('/');
});

it('без бесед отдаёт пустой список и ничего не открывает', function () {
    $this->actingAs(User::factory()->create())->get('/messages')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Messages/Index')
            ->has('conversations', 0)
            ->where('active', null)
            ->where('compose', null));
});

it('список: только беседы пользователя, свежие сверху, роль, собеседник, объявление, последнее сообщение, непрочитанные', function () {
    $me = User::factory()->create(['name' => 'Я']);
    // Пользователь покупает по старой беседе и продаёт по новой.
    $older = MessagingFixtures::conversation(null, $me);
    $newer = MessagingFixtures::conversation(Listing::factory()->inStatus(ListingStatus::Published)->create(['user_id' => $me->id]));
    MessagingFixtures::conversation(); // чужая беседа

    say($older, participant($older, 'seller'), 'Первое от продавца');
    say($older, participant($older, 'seller'), 'Второе от продавца');
    $this->travel(5)->minutes();
    say($newer, participant($newer, 'buyer'), 'Вопрос покупателя');
    say($newer, $me, 'Мой ответ');

    $this->actingAs($me)->get('/messages')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Messages/Index')
            ->has('conversations', 2)
            ->where('conversations.0.id', $newer->id)
            ->where('conversations.0.role', 'selling')
            ->where('conversations.0.unread', 1)
            ->where('conversations.0.last_message.body', 'Мой ответ')
            ->where('conversations.0.last_message.mine', true)
            ->where('conversations.0.counterpart.name', 'Покупатель')
            ->where('conversations.0.listing.id', $newer->listing_id)
            ->missing('conversations.0.closed')
            ->where('conversations.1.id', $older->id)
            ->where('conversations.1.role', 'buying')
            ->where('conversations.1.unread', 2)
            ->where('conversations.1.last_message.body', 'Второе от продавца')
            ->where('conversations.1.last_message.mine', false)
            ->where('active', null));
});

it('список не раскрывает почту и служебные поля собеседника (BR-04)', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = participant($conversation, 'buyer');
    $seller = participant($conversation, 'seller');
    say($conversation, $buyer, 'Здравствуйте');

    $content = $this->actingAs($seller)->get('/messages')->assertOk()->getContent();

    expect($content)->not->toContain($buyer->email)
        ->and($content)->not->toContain('yandex_id');
});

it('прочитанные сообщения в непрочитанные не входят', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = participant($conversation, 'buyer');
    $seller = participant($conversation, 'seller');
    say($conversation, $seller, 'Ответ');
    app(MarkConversationRead::class)->handle($buyer, $conversation);

    $this->actingAs($buyer)->get('/messages')
        ->assertInertia(fn (AssertableInertia $page) => $page->where('conversations.0.unread', 0));
});

it('беседа по давно снятому объявлению в списке остаётся обычной: без признаков «закрыта» и причины', function () {
    $old = MessagingFixtures::conversation(MessagingFixtures::listing(ListingStatus::Withdrawn, now()->subDays(100)));
    $me = participant($old, 'buyer');
    $old->forceFill(['last_message_at' => now()->subDay()])->save();

    $this->actingAs($me)->get('/messages')
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('conversations.0.id', $old->id)
            ->missing('conversations.0.closed')
            ->missing('conversations.0.closed_reason')
            ->where('conversations.0.listing.status', 'withdrawn'));
});

it('открытая беседа: данные беседы, сообщения от старых к новым, признак «моё», есть ли более ранние', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = participant($conversation, 'buyer');
    $seller = participant($conversation, 'seller');
    say($conversation, $buyer, 'Ещё продаётся?');
    say($conversation, $seller, 'Да');

    $this->actingAs($buyer)->get("/messages/{$conversation->id}")
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Messages/Index')
            ->has('conversations', 1)
            ->where('active.conversation.id', $conversation->id)
            ->missing('active.conversation.closed_reason')
            ->where('active.messages.0.body', 'Ещё продаётся?')
            ->where('active.messages.0.mine', true)
            ->where('active.messages.1.body', 'Да')
            ->where('active.messages.1.mine', false)
            ->where('active.has_more', false)
            ->where('compose', null));
});

it('открытие страницы само ничего не отмечает прочитанным: это делает клиент, когда чат на экране', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = participant($conversation, 'buyer');
    say($conversation, participant($conversation, 'seller'), 'Здравствуйте');

    $this->actingAs($buyer)->get("/messages/{$conversation->id}")->assertOk();

    expect(Message::query()->whereNull('read_at')->count())->toBe(1);
});

it('чужая беседа и несуществующий id — 404', function () {
    $conversation = MessagingFixtures::conversation();

    $this->actingAs(User::factory()->create())->get("/messages/{$conversation->id}")->assertNotFound();
    $this->get('/messages/'.Str::uuid())->assertNotFound();
});

it('статус объявления в беседе: последнее состояние без причины снятия', function (ListingStatus $status, ?WithdrawReason $reason, string $expected) {
    $listing = MessagingFixtures::listing($status, now()->subDays(40));
    $conversation = MessagingFixtures::conversation($listing);
    if ($reason !== null) {
        SaleRecord::query()->create(['listing_id' => $listing->id, 'reason' => $reason]);
    }

    $this->actingAs(participant($conversation, 'buyer'))->get("/messages/{$conversation->id}")
        ->assertInertia(fn (AssertableInertia $p) => $p
            ->where('active.conversation.listing.status', $expected)
            ->missing('active.conversation.listing.reason')
            ->missing('active.conversation.listing.withdraw_reason'));
})->with([
    'опубликовано' => [ListingStatus::Published, null, 'published'],
    'продано' => [ListingStatus::Withdrawn, WithdrawReason::SoldHere, 'sold'],
    'продано в другом месте' => [ListingStatus::Withdrawn, WithdrawReason::SoldElsewhere, 'sold'],
    'снято' => [ListingStatus::Withdrawn, WithdrawReason::ChangedMind, 'withdrawn'],
    'снято модерацией: причина не раскрывается' => [ListingStatus::Withdrawn, WithdrawReason::Moderation, 'withdrawn'],
    'истёк срок' => [ListingStatus::Expired, null, 'expired'],
    'на проверке' => [ListingStatus::Pending, null, 'pending'],
    'отклонено' => [ListingStatus::Rejected, null, 'rejected'],
]);

it('карточка объявления вверху беседы: название, цена, статус и обложка без серийного номера', function () {
    Storage::fake(config('photos.disk'));
    $listing = MessagingFixtures::listing(ListingStatus::Withdrawn, now()->subDays(40));
    $listing->forceFill(['price' => 184_500])->save();
    $serial = ListingPhoto::query()->create(['listing_id' => $listing->id, 'path' => 'photos/s', 'position' => 0, 'is_serial' => true]);
    $serial->forceFill(['processed_at' => now()])->save();
    $cover = ListingPhoto::query()->create(['listing_id' => $listing->id, 'path' => 'photos/c', 'position' => 1]);
    $cover->forceFill(['processed_at' => now()])->save();
    $conversation = MessagingFixtures::conversation($listing);

    $this->actingAs(participant($conversation, 'buyer'))->get("/messages/{$conversation->id}")
        ->assertInertia(fn (AssertableInertia $p) => $p
            ->where('active.conversation.listing.title', $listing->title)
            ->where('active.conversation.listing.price', 184_500)
            ->where('active.conversation.listing.available', false)
            ->where('active.conversation.listing.cover.webp', fn ($url) => str_contains((string) $url, "/media/photos/{$cover->id}/square.webp"))
            ->where('active.conversation.listing.cover.avif', fn ($url) => str_contains((string) $url, "/media/photos/{$cover->id}/square.avif")));
});

it('без готовой обложки cover — null', function () {
    $conversation = MessagingFixtures::conversation();

    $this->actingAs(participant($conversation, 'buyer'))->get("/messages/{$conversation->id}")
        ->assertInertia(fn (AssertableInertia $p) => $p->where('active.conversation.listing.cover', null));
});

it('собеседник удалил аккаунт — имя не показывается, признак deleted есть, причины закрытия нет', function () {
    $conversation = MessagingFixtures::conversation();
    $seller = participant($conversation, 'seller');
    $buyer = participant($conversation, 'buyer');
    say($conversation, $buyer, 'Здравствуйте');
    app(AnonymizeParticipant::class)->handle($buyer);

    $this->actingAs($seller)->get("/messages/{$conversation->id}")
        ->assertInertia(fn (AssertableInertia $p) => $p
            ->missing('active.conversation.closed_reason')
            ->where('active.conversation.counterpart.deleted', true));
});

it('JSON истории беседы: статус объявления есть, причины закрытия нет', function () {
    $conversation = MessagingFixtures::conversation(MessagingFixtures::listing(ListingStatus::Rejected, now()->subDay()));

    $this->actingAs(participant($conversation, 'buyer'))->getJson("/conversations/{$conversation->id}/messages")
        ->assertOk()
        ->assertJsonPath('conversation.listing.status', 'rejected')
        ->assertJsonMissingPath('conversation.closed_reason');
});

it('«Написать»: по опубликованному чужому объявлению без беседы открывает черновик — беседа появится с первым сообщением', function () {
    $listing = MessagingFixtures::listing();
    $buyer = User::factory()->create();

    $this->actingAs($buyer)->get('/messages?listing='.$listing->id)
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Messages/Index')
            ->where('active', null)
            ->where('compose.listing.id', $listing->id)
            ->where('compose.listing.title', $listing->title)
            ->where('compose.listing.price', $listing->price)
            ->where('compose.counterpart.name', $listing->user->name));

    expect(Conversation::query()->count())->toBe(0);
});

it('«Написать»: беседа уже есть — переход в неё', function () {
    $conversation = MessagingFixtures::conversation();

    $this->actingAs(participant($conversation, 'buyer'))->get('/messages?listing='.$conversation->listing_id)
        ->assertRedirect("/messages/{$conversation->id}");
});

it('«Написать»: своё, неопубликованное и несуществующее объявление — на список сообщений', function () {
    $own = MessagingFixtures::listing();
    $draft = MessagingFixtures::listing(ListingStatus::Withdrawn, now()->subDay());
    $buyer = User::factory()->create();

    $this->actingAs($own->user)->get('/messages?listing='.$own->id)->assertRedirect('/messages');
    $this->actingAs($buyer)->get('/messages?listing='.$draft->id)->assertRedirect('/messages');
    $this->get('/messages?listing='.Str::uuid())->assertRedirect('/messages');
    $this->get('/messages?listing=не-идентификатор')->assertRedirect('/messages');
});

it('shared prop messages.unread — число непрочитанных на каждой странице вошедшего', function () {
    $conversation = MessagingFixtures::conversation();
    say($conversation, participant($conversation, 'seller'), 'Раз');
    say($conversation, participant($conversation, 'seller'), 'Два');

    $this->actingAs(participant($conversation, 'buyer'))->get('/messages')
        ->assertInertia(fn (AssertableInertia $page) => $page->where('messages.unread', 2));
});

it('список ограничен messaging.list_limit беседами (по умолчанию 100)', function () {
    $me = User::factory()->create();
    foreach (range(1, 3) as $i) {
        MessagingFixtures::conversation(Listing::factory()->inStatus(ListingStatus::Published)->create(), $me);
    }
    expect(config('messaging.list_limit'))->toBe(100);
    config(['messaging.list_limit' => 2]);

    $this->actingAs($me)->get('/messages')->assertInertia(fn (AssertableInertia $page) => $page->has('conversations', 2));
});

/**
 * Сколько запросов к таблицам списка бесед (беседы, сообщения, объявления, продажи, пользователи) выполнил колбэк.
 * Общие запросы оболочки страницы (флаги, категории, город) не считаются: они не зависят от числа бесед.
 */
function queryCount(Closure $callback): int
{
    DB::flushQueryLog();
    DB::enableQueryLog();
    $callback();
    $log = DB::getQueryLog();
    DB::disableQueryLog();

    return count(array_filter(
        $log,
        fn (array $entry): bool => preg_match('/from "(conversations|messages|listings|sale_records|users)"/', (string) $entry['query']) === 1,
    ));
}

/** Беседы пользователя с сообщениями в обе стороны. */
function conversationsFor(User $me, int $count): void
{
    foreach (range(1, $count) as $i) {
        $conversation = MessagingFixtures::conversation(null, $me);
        say($conversation, participant($conversation, 'seller'), "Сообщение продавца {$i}");
        say($conversation, $me, "Ответ {$i}");
        say($conversation, participant($conversation, 'seller'), "Ещё одно {$i}");
    }
}

it('UserConversations: число запросов не зависит от числа бесед (нет N+1)', function () {
    $me = User::factory()->create();
    conversationsFor($me, 3);
    $query = app(UserConversations::class);
    $query->for($me); // прогрев
    $few = queryCount(fn () => $query->for($me));

    conversationsFor($me, 27);
    $many = queryCount(fn () => $query->for($me));

    expect($query->for($me))->toHaveCount(30)
        ->and($few)->toBeLessThanOrEqual(8)
        ->and($many)->toBe($few);
});

it('страница /messages: число запросов одинаково для 3 и 30 бесед (список и Resource без N+1)', function () {
    $me = User::factory()->create();
    conversationsFor($me, 3);
    $this->actingAs($me)->get('/messages')->assertOk(); // прогрев
    $few = queryCount(fn () => $this->actingAs($me)->get('/messages')->assertOk());

    conversationsFor($me, 27);
    $many = queryCount(fn () => $this->actingAs($me)->get('/messages')->assertOk());

    expect($many)->toBe($few);
});
