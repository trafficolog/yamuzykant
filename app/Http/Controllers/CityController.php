<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Queries\CitySearch;
use App\Domain\Catalog\Queries\CurrentCity;
use App\Http\Requests\Catalog\ChangeCityRequest;
use App\Http\Requests\Catalog\CitySearchRequest;
use App\Http\Resources\Catalog\CityOptionResource;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class CityController extends Controller
{
    /** Год в минутах: срок cookie гостевого города. */
    private const COOKIE_MINUTES = 60 * 24 * 365;

    /**
     * Смена города. Существование города проверено правилом `exists` в ChangeCityRequest, поэтому id
     * пишется без повторного запроса. Вошедший — в users.city_id, гость — в cookie на год (SameSite=Lax).
     */
    public function update(ChangeCityRequest $request): RedirectResponse
    {
        $cityId = $request->integer('city_id');

        $user = $request->user();
        if ($user instanceof User) {
            $user->update(['city_id' => $cityId]);
        }

        return back()->withCookie(cookie(
            CurrentCity::COOKIE,
            (string) $cityId,
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
    public function search(CitySearchRequest $request): AnonymousResourceCollection
    {
        return CityOptionResource::collection((new CitySearch)($request->string('q')->toString()));
    }
}
