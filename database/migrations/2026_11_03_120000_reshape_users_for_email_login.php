<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Пользователи под вход по коду и Яндекс ID (1.1.1): без паролей и телефона.
 * Колонки согласия nullable на уровне БД (в таблице уже могут быть строки),
 * обязательность при создании аккаунта обеспечивает CompleteLogin.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['password', 'email_verified_at']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('yandex_id')->nullable()->unique();
            $table->foreignId('city_id')->nullable()->constrained('cities')->nullOnDelete();
            $table->jsonb('notification_prefs')->nullable();
            $table->string('consent_version')->nullable();
            $table->timestamp('consented_at')->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->unsignedInteger('session_version')->default(0);
        });

        Schema::dropIfExists('password_reset_tokens');
    }

    /**
     * Откат возвращает схему каркаса; пароль возвращается nullable — исходных хэшей уже нет.
     */
    public function down(): void
    {
        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['city_id']);
            $table->dropUnique(['yandex_id']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'yandex_id', 'city_id', 'notification_prefs', 'consent_version',
                'consented_at', 'last_login_at', 'session_version',
            ]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password')->nullable();
        });
    }
};
