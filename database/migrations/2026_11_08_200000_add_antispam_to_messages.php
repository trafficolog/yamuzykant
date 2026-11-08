<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Антиспам сообщений (4.1.3).
 *
 * - client_id — ключ идемпотентности отправки: повтор с тем же ключом возвращает сохранённое сообщение.
 *   Уникален в беседе для автора (ключи двух участников не мешают друг другу).
 * - body_hash — хеш нормализованного текста для признака «одинаковый текст в ≥ 5 чатах»; сам текст в индекс не идёт.
 * - suspicious — сообщение с плашкой «Будьте осторожны»; причины и статус разбора — в message_flags (очередь модерации).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->string('client_id', 64)->nullable();
            $table->string('body_hash', 40)->nullable();
            $table->boolean('suspicious')->default(false);

            // NULL в уникальном индексе не конфликтуют: сообщения без ключа (системные, старый клиент) допустимы.
            $table->unique(['conversation_id', 'sender_id', 'client_id']);
            $table->index(['sender_id', 'body_hash', 'created_at']);
        });

        Schema::create('message_flags', function (Blueprint $table) {
            $table->foreignId('message_id')->primary()->constrained('messages')->cascadeOnDelete();
            // Коды признаков (SpamSignal): текст сообщения сюда не копируется.
            $table->json('signals');
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            // Очередь модерации: неразобранные по давности.
            $table->index(['reviewed_at', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_flags');

        Schema::table('messages', function (Blueprint $table) {
            $table->dropIndex(['sender_id', 'body_hash', 'created_at']);
            $table->dropUnique(['conversation_id', 'sender_id', 'client_id']);
            $table->dropColumn(['client_id', 'body_hash', 'suspicious']);
        });
    }
};
