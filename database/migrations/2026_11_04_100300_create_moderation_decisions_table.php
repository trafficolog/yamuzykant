<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Решения модерации по объявлению (SPEC UC-O1). Причина хранится дословно, как её увидит продавец.
 * staff_id без внешнего ключа: таблица сотрудников появится вместе со staff-guard (5.3.1).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('moderation_decisions', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('listing_id')->constrained('listings')->cascadeOnDelete();
            // approved | returned | rejected — см. ModerationVerdict.
            $table->string('verdict', 16);
            $table->text('reason')->nullable();
            $table->unsignedBigInteger('staff_id')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('listing_id');
            $table->index('staff_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('moderation_decisions');
    }
};
