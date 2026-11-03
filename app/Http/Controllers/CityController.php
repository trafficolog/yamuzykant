<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Catalog\Models\City;
use App\Domain\Catalog\Queries\CitySearch;
use App\Domain\Catalog\Queries\CurrentCity;
use App\Http\Requests\Catalog\ChangeCityRequest;
use App\Http\Resources\Catalog\CityOptionResource;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class CityController extends Controller
{
    /** Год в минутах: срок cookie гостевого города. */
    private const COOKIE_MINUTES = 60 * 24 * 365;

    /** Смена города: cookie на год, SameSite=Lax, возврат на ту же страницу (Inertia-визит без перезагрузки). */
    public function update(ChangeCityRequest $request): RedirectResponse
    {
        $city = City::query()->findOrFail($request->integer('city_id'));

        return back()->withCookie(cookie(
            CurrentCity::COOKIE,
            (string) $city->id,
            self::COOKIE_MINUTES,
            '/',
            null,
            null,
            true,
            false,
            'lax',
        ));
    }

    /** Справочник городов для окна выбора: JSON, явный список полей. */
    public function search(Request $request): AnonymousResourceCollection
    {
        $query = $request->string('q')->toString();

        return CityOptionResource::collection((new CitySearch)($query));
    }
}
