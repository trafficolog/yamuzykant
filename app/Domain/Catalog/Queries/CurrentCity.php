<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Queries;

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Models\City;
use Illuminate\Http\Request;

/**
 * Город, по которому работает сайт (BR-01). Порядок: город вошедшего (users.city_id), затем гостевая
 * cookie `ym_city` с id города, затем умолчание из config/city.php. Каждая ветка — не больше одного запроса.
 */
final class CurrentCity
{
    public const COOKIE = 'ym_city';

    public function for(Request $request): ?City
    {
        $user = $request->user();

        if ($user instanceof User && $user->city_id !== null) {
            $city = $user->city;

            if ($city !== null) {
                return $city;
            }
        }

        $id = $request->cookie(self::COOKIE);

        // Подменённая или массивная cookie не даёт id: ctype_digit отсекает всё, кроме цифр.
        if (is_string($id) && ctype_digit($id)) {
            $city = City::query()->find((int) $id);

            if ($city !== null) {
                return $city;
            }
        }

        return City::query()->where('slug', config('city.default_slug'))->first();
    }
}
