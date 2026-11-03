<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('instrument_models', function (Blueprint $table) {
            $table->id();
            $table->string('brand');
            $table->string('name');
            $table->unsignedSmallInteger('year_from')->nullable();
            $table->unsignedSmallInteger('year_to')->nullable();
            $table->foreignId('category_id')->constrained('categories')->restrictOnDelete();
            // active | suggested | hidden — см. InstrumentModelStatus.
            $table->string('status', 16)->default('active');
            $table->timestamps();

            $table->unique(['brand', 'name']);
            $table->index(['category_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('instrument_models');
    }
};
