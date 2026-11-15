<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Catalog\Queries\CurrentCity;
use App\Domain\Search\HomeRails;
use App\Http\Resources\Listings\FleaListingResource;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Главная (UC-S2): рельсы свежих объявлений города шапки (BR-01). Наружу уходят только карточки
 * из FleaListingResource; блоки кэшируются в HomeRails на 60 с.
 */
final class HomeController extends Controller
{
    public function __invoke(Request $request, HomeRails $rails): Response
    {
        $city = (new CurrentCity)->for($request);
        $blocks = $rails->for($city);
        $name = $city->name ?? '';

        return Inertia::render('Home', [
            'rails' => [
                'fresh' => FleaListingResource::cards($blocks['fresh'], $name, $request),
                'negotiable' => FleaListingResource::cards($blocks['negotiable'], $name, $request),
            ],
            // Город без склонения (решение OWNER 08.11.2026): «г. Москва», тип населённого пункта — из справочника.
            'cityLabel' => $city === null ? null : trim($city->settlement_type.' '.$city->name),
        ]);
    }
}
