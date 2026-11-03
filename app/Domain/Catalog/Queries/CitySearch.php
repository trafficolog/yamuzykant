<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Queries;

use App\Domain\Catalog\Models\City;
use Illuminate\Database\Eloquent\Collection;

/**
 * Поиск города в справочнике по подстроке названия без учёта регистра.
 * Справочник — города-миллионники (сотни строк максимум), поэтому фильтр в памяти: одинаково
 * работает в PostgreSQL и SQLite с кириллицей. При расширении справочника — перейти на поиск в БД.
 */
final class CitySearch
{
    public const LIMIT = 50;

    /** @return Collection<int, City> */
    public function __invoke(string $query = ''): Collection
    {
        $query = trim($query);

        $cities = City::query()->ordered()->get();

        if ($query !== '') {
            $cities = $cities->filter(fn (City $city): bool => mb_stripos($city->name, $query) !== false);
        }

        return $cities->values()->take(self::LIMIT);
    }
}
