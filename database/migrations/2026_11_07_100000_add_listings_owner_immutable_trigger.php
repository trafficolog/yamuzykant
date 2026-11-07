<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Владелец объявления неизменен на уровне БД (2.1.8). Хук saving и Listing::fill() не видят
 * saveQuietly(), Listing::query()->update() и DB::table('listings')->update(): триггер BEFORE UPDATE OF user_id
 * бросает ошибку, если значение меняется. Запись того же значения проходит; INSERT триггер не затрагивает.
 * PostgreSQL — рабочая БД; SQLite (тесты) получает эквивалентный триггер, чтобы обходы проверялись и локально.
 */
return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::unprepared(<<<'SQL'
                CREATE OR REPLACE FUNCTION listings_forbid_owner_change() RETURNS trigger AS $$
                BEGIN
                    RAISE EXCEPTION 'listings.user_id is immutable' USING ERRCODE = 'integrity_constraint_violation';
                END;
                $$ LANGUAGE plpgsql
                SQL);
            DB::unprepared(<<<'SQL'
                CREATE TRIGGER listings_owner_immutable
                BEFORE UPDATE OF user_id ON listings
                FOR EACH ROW WHEN (OLD.user_id IS DISTINCT FROM NEW.user_id)
                EXECUTE FUNCTION listings_forbid_owner_change()
                SQL);
        } elseif ($driver === 'sqlite') {
            DB::unprepared(<<<'SQL'
                CREATE TRIGGER listings_owner_immutable
                BEFORE UPDATE OF user_id ON listings
                FOR EACH ROW WHEN OLD.user_id IS NOT NEW.user_id
                BEGIN
                    SELECT RAISE(ABORT, 'listings.user_id is immutable');
                END
                SQL);
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::unprepared('DROP TRIGGER IF EXISTS listings_owner_immutable ON listings');
            DB::unprepared('DROP FUNCTION IF EXISTS listings_forbid_owner_change()');
        } elseif ($driver === 'sqlite') {
            DB::unprepared('DROP TRIGGER IF EXISTS listings_owner_immutable');
        }
    }
};
