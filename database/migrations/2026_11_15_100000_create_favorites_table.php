<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Избранное (SPEC §7 FAVORITE, UC-S5; задача 4.3.1). Запись живёт, пока жив пользователь и объявление:
 * снятое с продажи остаётся в списке как недоступное. `price_at_save` — цена на момент добавления: по ней
 * в «Избранном» подсвечивается снижение (`null` — «Договорная», `0` — «Бесплатно», BR-11).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('favorites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('listing_id')->constrained('listings')->cascadeOnDelete();
            $table->unsignedBigInteger('price_at_save')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['user_id', 'listing_id']);
            // Письма о снижении цены (по объявлению → кто его сохранил).
            $table->index('listing_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('favorites');
    }
};
