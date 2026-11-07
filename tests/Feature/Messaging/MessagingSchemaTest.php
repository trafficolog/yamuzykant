<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Enums\MessageKind;
use App\Domain\Messaging\Models\Message;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\Support\MessagingFixtures;

// 4.1.1: conversations (listing_id, buyer_id, seller_id, unique), messages (body, kind, read_at).

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('таблицы бесед и сообщений с полями из карточки', function () {
    expect(Schema::hasColumns('conversations', ['id', 'listing_id', 'buyer_id', 'seller_id', 'last_message_at']))->toBeTrue()
        ->and(Schema::hasColumns('messages', ['id', 'conversation_id', 'sender_id', 'kind', 'body', 'read_at', 'created_at']))->toBeTrue();
});

it('одна беседа на пару объявление–покупатель', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);

    expect(fn () => MessagingFixtures::conversation($conversation->listing, $buyer))
        ->toThrow(UniqueConstraintViolationException::class);
});

it('виды сообщений: text, system, offer (offer — для предложений цены в G2)', function () {
    expect(array_map(fn (MessageKind $kind): string => $kind->value, MessageKind::cases()))
        ->toBe(['text', 'system', 'offer']);

    $conversation = MessagingFixtures::conversation();
    $message = new Message;
    $message->conversation_id = $conversation->id;
    $message->kind = MessageKind::System;
    $message->body = 'Цена согласована: 180 000 ₽';
    $message->save();

    expect($message->refresh()->kind)->toBe(MessageKind::System)
        ->and($message->sender_id)->toBeNull();
});

it('продавец не может быть покупателем в своей беседе — ограничение в БД (pgsql)', function () {
    if (DB::getDriverName() !== 'pgsql') {
        $this->markTestSkipped('CHECK-ограничение создаётся только в PostgreSQL');
    }

    $listing = MessagingFixtures::listing();

    expect(fn () => DB::table('conversations')->insert([
        'id' => (string) Str::uuid(),
        'listing_id' => $listing->id,
        'buyer_id' => $listing->user_id,
        'seller_id' => $listing->user_id,
        'created_at' => now(),
        'updated_at' => now(),
    ]))->toThrow(QueryException::class);
});

it('миграции сообщений откатываются', function () {
    Artisan::call('migrate:rollback', ['--path' => 'database/migrations/2026_11_07_100000_create_messaging_tables.php']);

    expect(Schema::hasTable('messages'))->toBeFalse()
        ->and(Schema::hasTable('conversations'))->toBeFalse();

    Artisan::call('migrate', ['--path' => 'database/migrations/2026_11_07_100000_create_messaging_tables.php']);
    expect(Schema::hasTable('messages'))->toBeTrue();
});
