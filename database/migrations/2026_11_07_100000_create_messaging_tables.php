<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Беседы и сообщения (SPEC §7 CONVERSATION, MESSAGE; задача 4.1.1).
 *
 * Участники и автор сообщения обнуляются при удалении пользователя (BR-09): переписка остаётся
 * у собеседника обезличенной. Беседа — одна на пару объявление–покупатель.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            // uuid, как у объявлений: id беседы не перебирается подряд (IDOR закрывает Policy, это — второй слой).
            $table->uuid('id')->primary();
            $table->foreignUuid('listing_id')->constrained('listings')->restrictOnDelete();
            $table->foreignId('buyer_id')->nullable()->constrained('users')->nullOnDelete();
            // Владелец объявления на момент первого сообщения (владелец объявления не меняется — 2.1.7).
            $table->foreignId('seller_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('last_message_at')->nullable();
            $table->timestamps();

            $table->unique(['listing_id', 'buyer_id']);
            // Списки бесед «Покупаю» / «Продаю» (4.1.2) по свежести.
            $table->index(['buyer_id', 'last_message_at']);
            $table->index(['seller_id', 'last_message_at']);
        });

        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('conversation_id')->constrained('conversations')->cascadeOnDelete();
            // null — системное сообщение или автор удалил аккаунт.
            $table->foreignId('sender_id')->nullable()->constrained('users')->nullOnDelete();
            // text | system | offer — см. MessageKind.
            $table->string('kind', 16)->default('text');
            $table->text('body');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            // История беседы по курсору id и непрочитанные.
            $table->index(['conversation_id', 'id']);
            $table->index(['conversation_id', 'read_at']);
            $table->index('sender_id');
        });

        // Продавец не пишет сам себе (UC-D1): защита в глубину к проверке домена.
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE conversations ADD CONSTRAINT conversations_buyer_is_not_seller CHECK (buyer_id <> seller_id)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversations');
    }
};
