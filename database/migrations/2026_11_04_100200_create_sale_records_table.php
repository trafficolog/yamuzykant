<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Итог снятия с продажи (SPEC UC-L4, §7 SALE_RECORD): одна запись на объявление.
 * Итоговая цена публично не показывается — только для «Цен продаж» и автопроверки «цена ≪ рынка».
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_records', function (Blueprint $table) {
            $table->foreignUuid('listing_id')->primary()->constrained('listings')->cascadeOnDelete();
            // sold_here | sold_elsewhere | changed_mind | moderation — см. WithdrawReason.
            $table->string('reason', 16);
            // Целые рубли; только для «продал».
            $table->unsignedInteger('final_price')->nullable();
            $table->date('sold_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_records');
    }
};
