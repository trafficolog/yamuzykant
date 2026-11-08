<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Итог автопроверок объявления (UC-O1, 5.1.1): риск high|normal и сигналы с пояснениями. Одна запись
 * на объявление — последняя проверка (после существенной правки перезаписывается). Показ модератору — 5.1.2.
 * Откат — down(): таблица только дописывается job'ом, потерять можно лишь флаги, их пересчитает следующая проверка.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('moderation_flags', function (Blueprint $table) {
            $table->foreignUuid('listing_id')->primary()->constrained('listings')->cascadeOnDelete();
            // high | normal — см. RiskLevel.
            $table->string('risk', 8);
            // [{code, field, message, details}] — см. Finding::toArray().
            $table->json('signals');
            $table->timestamps();

            // Очередь модерации сортируется по риску.
            $table->index('risk');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('moderation_flags');
    }
};
