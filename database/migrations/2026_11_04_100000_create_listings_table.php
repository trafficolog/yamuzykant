<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Объявления (SPEC §7 LISTING). Поля содержания nullable: черновик сохраняется с любого шага (UC-L1 7b),
 * полноту проверяет публикация (2.1.4). Статус меняет только ListingStateMachine.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('listings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            // draft | pending | published | needs_changes | rejected | withdrawn | expired — см. ListingStatus.
            $table->string('status', 16)->default('draft');
            $table->foreignId('category_id')->nullable()->constrained('categories')->restrictOnDelete();
            $table->foreignId('model_id')->nullable()->constrained('instrument_models')->nullOnDelete();
            $table->string('title')->nullable();
            $table->unsignedSmallInteger('year')->nullable();
            // Шифротекст encrypted-cast: длина не ограничена длиной номера.
            $table->text('serial_enc')->nullable();
            // 8 ступеней BR-02 — см. Condition.
            $table->string('condition', 16)->nullable();
            $table->text('description')->nullable();
            // Целые рубли.
            $table->unsignedInteger('price')->nullable();
            $table->boolean('negotiable')->default(false);
            $table->boolean('meet')->default(true);
            $table->boolean('ship')->default(false);
            $table->foreignId('city_id')->nullable()->constrained('cities')->restrictOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            // PostgreSQL не создаёт индексы под внешние ключи сам.
            $table->index('user_id');
            $table->index('status');
            $table->index('category_id');
            $table->index('model_id');
            $table->index('city_id');
            $table->index('price');
            $table->index('published_at');
            // Снятие по сроку: published + published_at раньше границы.
            $table->index(['status', 'published_at']);
        });

        // В PostgreSQL unsignedInteger — обычный integer: неотрицательность денег задаём явно.
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE listings ADD CONSTRAINT listings_price_non_negative CHECK (price >= 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('listings');
    }
};
