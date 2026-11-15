<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Мои объявления (2.1.5): счётчик просмотров и история цены (рост цены без модерации пишется сюда, SPEC §6.1).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('listings', function (Blueprint $table) {
            $table->unsignedInteger('views_count')->default(0);
        });

        Schema::create('listing_price_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('listing_id')->constrained('listings')->cascadeOnDelete();
            // null — «Договорная»; 0 — «Бесплатно» (BR-11).
            $table->unsignedInteger('old_price')->nullable();
            $table->unsignedInteger('new_price')->nullable();
            $table->timestamp('changed_at');
            $table->index(['listing_id', 'changed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listing_price_changes');
        Schema::table('listings', function (Blueprint $table) {
            $table->dropColumn('views_count');
        });
    }
};
