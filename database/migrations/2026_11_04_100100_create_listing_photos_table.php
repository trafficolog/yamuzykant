<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Фото объявления (BR-03: 3–12, одно — серийный номер). Загрузка и обработка — задача 2.1.2.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('listing_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('listing_id')->constrained('listings')->cascadeOnDelete();
            $table->string('path');
            $table->unsignedTinyInteger('position');
            $table->boolean('is_serial')->default(false);
            $table->timestamps();

            $table->unique(['listing_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listing_photos');
    }
};
