<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Queries;

use App\Domain\Catalog\Models\City;
use Illuminate\Http\Request;

/**
 * Город, по которому работает сайт (BR-01). Гость — cookie `ym_city` с id города; без cookie
 * или при удалённом городе — Москва. Вошедший пользователь (users.city_id) — задача 1.1.1.
 */
final class CurrentCity
{
    public const COOKIE = 'ym_city';

    public const DEFAULT_NAME = 'Москва';

    public function for(Request $request): ?City
    {
        $id = $request->cookie(self::COOKIE);

        if (is_string($id) && ctype_digit($id)) {
            $city = City::query()->find((int) $id);

            if ($city !== null) {
                return $city;
            }
        }

        return City::query()->where('name', self::DEFAULT_NAME)->first();
    }
}
