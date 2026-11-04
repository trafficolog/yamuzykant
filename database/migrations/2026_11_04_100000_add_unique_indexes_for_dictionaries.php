<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Уникальность справочников, которую не выражают обычные UNIQUE-ограничения (ревью PR #85 и #92).
 *
 * - Корневые категории: в UNIQUE(parent_id, slug) значения NULL не сравниваются, поэтому два вида с одним slug
 *   проходили. Частичный индекс по slug только для parent_id IS NULL. Одинаковый slug у детей разных родителей допустим.
 * - Модели: пара (brand, name) без учёта регистра. Индекс по lower() — и в PostgreSQL, и в SQLite.
 *
 * Откат удаляет оба индекса; данные не меняются.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE UNIQUE INDEX categories_root_slug_unique ON categories (slug) WHERE parent_id IS NULL');
        DB::statement('CREATE UNIQUE INDEX instrument_models_brand_name_ci_unique ON instrument_models (lower(brand), lower(name))');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS instrument_models_brand_name_ci_unique');
        DB::statement('DROP INDEX IF EXISTS categories_root_slug_unique');
    }
};
