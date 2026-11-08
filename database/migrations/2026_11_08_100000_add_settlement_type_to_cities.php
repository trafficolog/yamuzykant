<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Краткий тип населённого пункта для подписей вроде «Встреча в г. Москва» (решение OWNER 08.11.2026: названия
 * городов не склоняем). Существующие города получают «г.» по умолчанию; откат убирает колонку.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cities', function (Blueprint $table): void {
            $table->string('settlement_type', 8)->default('г.');
        });
    }

    public function down(): void
    {
        Schema::table('cities', function (Blueprint $table): void {
            $table->dropColumn('settlement_type');
        });
    }
};
