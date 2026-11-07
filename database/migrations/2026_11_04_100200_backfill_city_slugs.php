<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Стабильный slug городов для уже заполненных окружений (ревью 1.1.4).
 *
 * Выбор: миграция, а не шаг деплоя. deploy.sh запускает только `migrate --force`, сиды на деплое не выполняются,
 * поэтому города stage и production без slug не нашли бы умолчание (config/city.php). Миграция идемпотентна:
 * трогает только строки с slug IS NULL, заданные slug не меняет.
 *
 * Откат не возвращает NULL: slug неотличим от заданного вручную, а колонку откатывает миграция add_slug_to_cities.
 */
return new class extends Migration
{
    /** Название города из CitySeeder на момент появления slug → slug. */
    private const SLUGS = [
        'Москва' => 'moscow',
        'Санкт-Петербург' => 'saint-petersburg',
        'Новосибирск' => 'novosibirsk',
        'Екатеринбург' => 'yekaterinburg',
        'Казань' => 'kazan',
        'Нижний Новгород' => 'nizhny-novgorod',
        'Красноярск' => 'krasnoyarsk',
        'Челябинск' => 'chelyabinsk',
        'Самара' => 'samara',
        'Уфа' => 'ufa',
        'Ростов-на-Дону' => 'rostov-on-don',
        'Краснодар' => 'krasnodar',
        'Омск' => 'omsk',
        'Воронеж' => 'voronezh',
        'Пермь' => 'perm',
        'Волгоград' => 'volgograd',
    ];

    public function up(): void
    {
        foreach (self::SLUGS as $name => $slug) {
            DB::table('cities')
                ->where('name', $name)
                ->whereNull('slug')
                ->update(['slug' => $slug]);
        }
    }

    public function down(): void
    {
        // Данные не откатываются (см. комментарий выше).
    }
};
