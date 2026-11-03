<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Catalog\Models\City;
use Illuminate\Database\Seeder;

/** Города-миллионники России (перепись 2021) с координатами центра и стабильным slug. */
class CitySeeder extends Seeder
{
    /**
     * @var list<array{0: string, 1: string, 2: string, 3: float, 4: float}>
     */
    private const CITIES = [
        ['Москва', 'Москва', 'moscow', 55.7558, 37.6173],
        ['Санкт-Петербург', 'Санкт-Петербург', 'saint-petersburg', 59.9343, 30.3351],
        ['Новосибирск', 'Новосибирская область', 'novosibirsk', 55.0084, 82.9357],
        ['Екатеринбург', 'Свердловская область', 'yekaterinburg', 56.8389, 60.6057],
        ['Казань', 'Республика Татарстан', 'kazan', 55.7887, 49.1221],
        ['Нижний Новгород', 'Нижегородская область', 'nizhny-novgorod', 56.2965, 43.9361],
        ['Красноярск', 'Красноярский край', 'krasnoyarsk', 56.0153, 92.8932],
        ['Челябинск', 'Челябинская область', 'chelyabinsk', 55.1644, 61.4368],
        ['Самара', 'Самарская область', 'samara', 53.1959, 50.1002],
        ['Уфа', 'Республика Башкортостан', 'ufa', 54.7388, 55.9721],
        ['Ростов-на-Дону', 'Ростовская область', 'rostov-on-don', 47.2357, 39.7015],
        ['Краснодар', 'Краснодарский край', 'krasnodar', 45.0355, 38.9753],
        ['Омск', 'Омская область', 'omsk', 54.9885, 73.3242],
        ['Воронеж', 'Воронежская область', 'voronezh', 51.6720, 39.1843],
        ['Пермь', 'Пермский край', 'perm', 58.0105, 56.2502],
        ['Волгоград', 'Волгоградская область', 'volgograd', 48.7080, 44.5133],
    ];

    public function run(): void
    {
        foreach (self::CITIES as [$name, $region, $slug, $lat, $lng]) {
            City::query()->updateOrCreate(
                ['name' => $name, 'region' => $region],
                ['slug' => $slug, 'lat' => $lat, 'lng' => $lng],
            );
        }
    }
}
