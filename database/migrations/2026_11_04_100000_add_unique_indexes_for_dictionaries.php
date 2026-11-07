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
        $this->assertNoCaseInsensitiveDuplicates();

        DB::statement('CREATE UNIQUE INDEX categories_root_slug_unique ON categories (slug) WHERE parent_id IS NULL');
        DB::statement('CREATE UNIQUE INDEX instrument_models_brand_name_ci_unique ON instrument_models (lower(brand), lower(name))');
    }

    /**
     * Предпроверка до CREATE INDEX: на окружении с дублями (например, Fender / fender) индекс не создать.
     * Вместо ошибки СУБД выводится перечень пар, чтобы их можно было разобрать вручную.
     */
    private function assertNoCaseInsensitiveDuplicates(): void
    {
        $groups = DB::table('instrument_models')
            ->selectRaw('lower(brand) AS brand_ci, lower(name) AS name_ci')
            ->groupByRaw('lower(brand), lower(name)')
            ->havingRaw('count(*) > 1')
            ->get();

        if ($groups->isEmpty()) {
            return;
        }

        $details = $groups->map(function (object $group): string {
            $rows = DB::table('instrument_models')
                ->whereRaw('lower(brand) = ?', [$group->brand_ci])
                ->whereRaw('lower(name) = ?', [$group->name_ci])
                ->orderBy('id')
                ->get(['id', 'brand', 'name']);

            $brand = (string) $rows->pluck('brand')->first();
            $name = (string) $rows->pluck('name')->first();

            return sprintf('«%s %s» — id %s', $brand, $name, $rows->pluck('id')->implode(', '));
        })->implode('; ');

        throw new RuntimeException(
            'Миграция остановлена: дубли (brand, name) без учёта регистра. Оставьте одну запись в каждой паре, '
            .'остальные удалите или переведите, затем повторите миграцию. Дубли: '.$details.'.',
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS instrument_models_brand_name_ci_unique');
        DB::statement('DROP INDEX IF EXISTS categories_root_slug_unique');
    }
};
