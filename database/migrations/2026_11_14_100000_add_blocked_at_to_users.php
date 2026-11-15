<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Признак блокировки пользователя (SPEC §6.4, мера `blocked`). Задача 3.1.6 только читает его: страница заблокированного
 * продавца отвечает 404. Выставляет и снимает признак задача 5.3.2 (меры и журнал). Откат убирает колонку.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->timestamp('blocked_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('blocked_at');
        });
    }
};
