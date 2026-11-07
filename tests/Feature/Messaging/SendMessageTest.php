<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Messaging\Actions\SendMessage;
use App\Domain\Messaging\Events\MessageSent;
use App\Domain\Messaging\Events\UnreadCountChanged;
use App\Domain\Messaging\Models\Message;
use Illuminate\Broadcasting\BroadcastEvent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\Support\MessagingFixtures;

// 4.1.1: сообщения в беседе — только участникам, по опубликованному объявлению, с лимитом частоты.

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('покупатель и продавец пишут в свою беседу', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    $seller = User::query()->findOrFail($conversation->seller_id);

    $this->actingAs($buyer)
        ->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Можно посмотреть в субботу?'])
        ->assertCreated()
        ->assertJsonPath('data.body', 'Можно посмотреть в субботу?')
        ->assertJsonPath('data.conversation_id', $conversation->id)
        ->assertJsonPath('data.sender_id', $buyer->id)
        ->assertJsonPath('data.mine', true);

    $this->actingAs($seller)
        ->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Да, после 12'])
        ->assertCreated()
        ->assertJsonPath('data.mine', true);

    $this->getJson("/conversations/{$conversation->id}/messages")
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.body', 'Можно посмотреть в субботу?')
        ->assertJsonPath('data.0.mine', false)
        ->assertJsonPath('data.1.body', 'Да, после 12')
        ->assertJsonPath('data.1.mine', true);
});

it('третье лицо не читает и не пишет в чужую беседу: 404 без раскрытия (IDOR)', function () {
    $conversation = MessagingFixtures::conversation();
    $this->actingAs(User::factory()->create());

    $this->getJson("/conversations/{$conversation->id}/messages")->assertNotFound();
    $this->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Я тут'])->assertNotFound();
    $this->postJson("/conversations/{$conversation->id}/read")->assertNotFound();

    expect(Message::query()->count())->toBe(0);
});

it('id беседы не по формату и несуществующий — 404', function () {
    $this->actingAs(User::factory()->create());

    $this->getJson('/conversations/1/messages')->assertNotFound();
    $this->getJson('/conversations/'.Str::uuid()->toString().'/messages')->assertNotFound();
});

it('курсор before не выдаёт сообщения другой беседы', function () {
    $mine = MessagingFixtures::conversation();
    $foreign = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($mine->buyer_id);
    $foreignBuyer = User::query()->findOrFail($foreign->buyer_id);

    app(SendMessage::class)->handle($foreignBuyer, $foreign, 'Чужой секрет');
    $own = app(SendMessage::class)->handle($buyer, $mine, 'Моё');

    $content = $this->actingAs($buyer)
        ->getJson("/conversations/{$mine->id}/messages?before=".($own->id + 100))
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->getContent();

    expect($content)->not->toContain('Чужой секрет');
});

it('сообщения отдаются страницами от новых к старым по курсору before', function () {
    config(['messaging.page_size' => 2]);
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    foreach (['1', '2', '3'] as $text) {
        app(SendMessage::class)->handle($buyer, $conversation, $text);
    }

    $this->actingAs($buyer);
    $page = $this->getJson("/conversations/{$conversation->id}/messages")->assertOk();
    expect(array_column($page->json('data'), 'body'))->toBe(['2', '3'])
        ->and($page->json('meta.has_more'))->toBeTrue();

    $older = $this->getJson("/conversations/{$conversation->id}/messages?before=".$page->json('data.0.id'))->assertOk();
    expect(array_column($older->json('data'), 'body'))->toBe(['1'])
        ->and($older->json('meta.has_more'))->toBeFalse();
});

it('после снятия объявления с продажи писать нельзя: 409 с понятным текстом', function (ListingStatus $status) {
    $conversation = MessagingFixtures::conversation(MessagingFixtures::listing($status));
    $buyer = User::query()->findOrFail($conversation->buyer_id);

    $this->actingAs($buyer)
        ->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Ещё актуально?'])
        ->assertConflict()
        ->assertJsonPath('message', 'Объявление не опубликовано — новые сообщения по нему недоступны.');

    // Переписка остаётся доступной для чтения.
    $this->getJson("/conversations/{$conversation->id}/messages")->assertOk();
    expect(Message::query()->count())->toBe(0);
})->with([ListingStatus::Withdrawn, ListingStatus::Expired, ListingStatus::Pending]);

it('собеседнику, удалившему аккаунт, написать нельзя', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    $conversation->seller_id = null;
    $conversation->save();

    $this->actingAs($buyer)
        ->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Алло'])
        ->assertConflict()
        ->assertJsonPath('message', 'Собеседник удалил аккаунт — новые сообщения недоступны.');
});

it('31-е сообщение за минуту отклоняется: 429 с понятным текстом (ARCHITECTURE §7)', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    $this->actingAs($buyer);

    foreach (range(1, 30) as $n) {
        $this->postJson("/conversations/{$conversation->id}/messages", ['body' => "Сообщение {$n}"])->assertCreated();
    }

    $this->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Лишнее'])
        ->assertTooManyRequests()
        ->assertHeader('Retry-After')
        ->assertJsonPath('message', 'Вы отправляете сообщения слишком часто. Подождите минуту и попробуйте снова.');

    // Лимит общий на пользователя: новая беседа тоже упирается в него.
    $listing = MessagingFixtures::listing();
    $this->postJson("/listings/{$listing->id}/conversations", ['body' => 'Здравствуйте'])->assertTooManyRequests();

    expect(Message::query()->count())->toBe(30);
});

it('лимит считается для каждого пользователя отдельно', function () {
    config(['messaging.send_per_minute' => 1]);
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    $seller = User::query()->findOrFail($conversation->seller_id);

    $this->actingAs($buyer)->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Раз'])->assertCreated();
    $this->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Два'])->assertTooManyRequests();
    $this->actingAs($seller)->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Ответ'])->assertCreated();
});

it('отправка транслирует MessageSent в беседу и счётчик непрочитанных получателю', function () {
    Event::fake([MessageSent::class, UnreadCountChanged::class]);
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);

    $this->actingAs($buyer)
        ->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Здравствуйте'])
        ->assertCreated();

    Event::assertDispatched(MessageSent::class, fn (MessageSent $event): bool => $event->message->conversation_id === $conversation->id);
    Event::assertDispatched(UnreadCountChanged::class, fn (UnreadCountChanged $event): bool => $event->userId === $conversation->seller_id);
    Event::assertNotDispatched(UnreadCountChanged::class, fn (UnreadCountChanged $event): bool => $event->userId === $buyer->id);
});

it('события транслируются только после commit: при откате транзакции — ничего', function () {
    Event::fake([MessageSent::class, UnreadCountChanged::class]);
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);

    try {
        DB::transaction(function () use ($buyer, $conversation): void {
            app(SendMessage::class)->handle($buyer, $conversation, 'Откатится');
            throw new RuntimeException('rollback');
        });
    } catch (RuntimeException) {
        // ожидаемо
    }

    Event::assertNotDispatched(MessageSent::class);
    Event::assertNotDispatched(UnreadCountChanged::class);
    expect(Message::query()->count())->toBe(0);
});

it('текст хранится и отдаётся как текст: HTML не исполняется, управляющие символы убраны', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);

    $response = $this->actingAs($buyer)
        ->postJson("/conversations/{$conversation->id}/messages", ['body' => "<script>alert(1)</script>\u{0007}\r\nПривет"])
        ->assertCreated()
        ->assertHeader('Content-Type', 'application/json');

    expect($response->json('data.body'))->toBe("<script>alert(1)</script>\nПривет")
        ->and($response->getContent())->not->toContain('<script>');
});

it('текст сообщения не попадает в журнал и в задание очереди трансляции', function () {
    $path = useTempJsonLog();
    Queue::fake();

    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    $secret = 'Встретимся у метро Сокол в 19:00';

    $this->actingAs($buyer)
        ->postJson("/conversations/{$conversation->id}/messages", ['body' => $secret])
        ->assertCreated();
    Log::info('после отправки');

    expect(implode("\n", readLogLines($path)))->not->toContain('Сокол');

    Queue::assertPushed(BroadcastEvent::class);
    Queue::assertPushed(BroadcastEvent::class, function (BroadcastEvent $job) use ($secret): bool {
        return ! str_contains(serialize($job), $secret);
    });
});
