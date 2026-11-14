<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Черновик (2.1.4):
 * - `draft_price_mode` — как продавец задал цену в форме (amount | negotiable | free), чтобы после перезагрузки
 *   отличить «Договорную» (price = null) от ещё не заполненной цены. Только у черновика: публикация сбрасывает
 *   поле, у объявления режим вычисляется из price (BR-11);
 * - частичный уникальный индекс: у пользователя не больше одного черновика (ревью PR #126). Блокировка в
 *   FindOrCreateDraft остаётся, но гарантия — на уровне БД. Частичные индексы есть и в PostgreSQL, и в SQLite.
 *
 * До выката проверить, что у пользователей нет двух черновиков одновременно (индекс создаётся только без дублей):
 * SELECT user_id FROM listings WHERE status = 'draft' GROUP BY user_id HAVING count(*) > 1.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('listings', function (Blueprint $table): void {
            $table->string('draft_price_mode', 10)->nullable()->after('price');
        });

        DB::statement("CREATE UNIQUE INDEX listings_one_draft_per_user ON listings (user_id) WHERE status = 'draft'");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX listings_one_draft_per_user');

        Schema::table('listings', function (Blueprint $table): void {
            $table->dropColumn('draft_price_mode');
        });
    }
};
