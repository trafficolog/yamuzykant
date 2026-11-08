<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Actions\SuggestInstrumentModel;
use App\Domain\Catalog\Exceptions\SuggestionLimitReached;
use App\Domain\Catalog\Models\Category;
use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Models\Message;
use Tests\Support\MessagingFixtures;
use Tests\Support\NoReadCache;

// 4.1.3: 30 сообщений в минуту и 20 новых чатов в сутки, атомарный счётчик (сначала увеличить, потом сравнить).

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('в конфиге заданы лимиты: 30 сообщений в минуту и 20 новых чатов в сутки', function () {
    expect(config('messaging.send_per_minute'))->toBe(30)
        ->and(config('messaging.new_chats_per_day'))->toBe(20);
});

it('21-й новый чат за сутки отклонён с понятным текстом, беседа не создаётся', function () {
    $buyer = User::factory()->create();
    $this->actingAs($buyer);

    foreach (range(1, 20) as $n) {
        $listing = MessagingFixtures::listing();
        $this->postJson("/listings/{$listing->id}/conversations", ['body' => "Здравствуйте, вопрос {$n}"])->assertCreated();
    }

    $listing = MessagingFixtures::listing();
    $this->postJson("/listings/{$listing->id}/conversations", ['body' => 'Ещё один чат'])
        ->assertTooManyRequests()
        ->assertJsonPath('message', 'Вы начали слишком много новых чатов за сутки. Продолжите завтра или ответьте в уже начатых.')
        ->assertJsonPath('code', 'new_chats_limit');

    expect(Conversation::query()->count())->toBe(20)
        ->and(Message::query()->count())->toBe(20);
});

it('сообщения в уже начатые чаты в лимит новых чатов не входят', function () {
    config(['messaging.new_chats_per_day' => 1]);
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    $this->actingAs($buyer);

    foreach (range(1, 5) as $n) {
        $this->postJson("/conversations/{$conversation->id}/messages", ['body' => "Сообщение {$n}"])->assertCreated();
    }
    // Повторное «Написать» по тому же объявлению продолжает беседу, а не открывает новый чат.
    $this->postJson("/listings/{$conversation->listing_id}/conversations", ['body' => 'Ещё раз'])->assertCreated();
});

it('лимит новых чатов у каждого пользователя свой и сбрасывается через сутки', function () {
    config(['messaging.new_chats_per_day' => 1]);
    $first = User::factory()->create();
    $second = User::factory()->create();

    $this->actingAs($first)->postJson('/listings/'.MessagingFixtures::listing()->id.'/conversations', ['body' => 'Раз'])->assertCreated();
    $this->postJson('/listings/'.MessagingFixtures::listing()->id.'/conversations', ['body' => 'Два'])->assertTooManyRequests();
    $this->actingAs($second)->postJson('/listings/'.MessagingFixtures::listing()->id.'/conversations', ['body' => 'Раз'])->assertCreated();

    $this->travel(25)->hours();

    $this->actingAs($first)->postJson('/listings/'.MessagingFixtures::listing()->id.'/conversations', ['body' => 'Два'])->assertCreated();
});

it('счётчики сообщений и новых чатов не читаются до увеличения (параллельные запросы не проходят сверх лимита)', function () {
    NoReadCache::install();
    config(['messaging.send_per_minute' => 3, 'messaging.new_chats_per_day' => 2]);
    $buyer = User::factory()->create();
    $this->actingAs($buyer);

    // Проверка и увеличение одной операцией: любое чтение счётчика в хранилище-ловушке — исключение.
    $this->postJson('/listings/'.MessagingFixtures::listing()->id.'/conversations', ['body' => 'Раз'])->assertCreated();
    $this->postJson('/listings/'.MessagingFixtures::listing()->id.'/conversations', ['body' => 'Два'])->assertCreated();
    $this->postJson('/listings/'.MessagingFixtures::listing()->id.'/conversations', ['body' => 'Три'])->assertTooManyRequests();
    $this->postJson('/listings/'.MessagingFixtures::listing()->id.'/conversations', ['body' => 'Четыре'])->assertTooManyRequests();
});

it('31-е сообщение за минуту отклоняется и при хранилище без чтения', function () {
    NoReadCache::install();
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    $this->actingAs($buyer);

    foreach (range(1, 30) as $n) {
        $this->postJson("/conversations/{$conversation->id}/messages", ['body' => "Сообщение {$n}"])->assertCreated();
    }

    $this->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Лишнее'])
        ->assertTooManyRequests()
        ->assertHeader('Retry-After');

    expect(Message::query()->count())->toBe(30);
});

it('суточный лимит предложений моделей считается тем же атомарным счётчиком', function () {
    NoReadCache::install();
    config(['catalog.suggestions_per_day' => 3]);
    $category = Category::factory()->create(['name' => 'Гитары', 'slug' => 'gitary-atomic', 'is_visible' => true]);
    $suggest = app(SuggestInstrumentModel::class);

    foreach (range(1, 3) as $n) {
        $suggest->forUser(7, "Ibanez RG{$n} Custom", $category->id);
    }

    expect(fn () => $suggest->forUser(7, 'Ibanez RG4 Custom', $category->id))->toThrow(SuggestionLimitReached::class);
    // Другой пользователь не затронут.
    expect($suggest->forUser(8, 'Ibanez RG5 Custom', $category->id)->exists)->toBeTrue();
});
