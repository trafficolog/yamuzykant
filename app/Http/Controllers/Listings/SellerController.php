<?php

declare(strict_types=1);

namespace App\Http\Controllers\Listings;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Queries\SellerListings;
use App\Http\Controllers\Controller;
use App\Http\Resources\Listings\ListingCardResource;
use App\Http\Resources\Listings\SellerResource;
use App\Http\Resources\Listings\SoldListingResource;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Страница продавца (UC-V2, 3.1.6): `/sellers/{id}`, открыта всем. Вкладки — `?tab=sold` («Продано»), по умолчанию
 * «В продаже». Заблокированный продавец — 404, как отсутствующий.
 */
final class SellerController extends Controller
{
    public function __invoke(Request $request, User $seller, SellerListings $listings): Response
    {
        abort_if($seller->isBlocked(), 404);

        $seller->load('city');
        $isSold = $request->query('tab') === 'sold';

        $page = $isSold
            ? $listings->sold($seller)->with(['city', 'saleRecord'])->paginate(SellerListings::PER_PAGE)
            : $listings->onSale($seller)->with(['city', 'photos'])->paginate(SellerListings::PER_PAGE);
        $items = $page->getCollection();

        return Inertia::render('Seller/Show', [
            'seller' => (new SellerResource($seller))->resolve($request),
            'tab' => $isSold ? 'sold' : 'sale',
            'counts' => [
                'sale' => $isSold ? $listings->onSale($seller)->count() : $page->total(),
                'sold' => $isSold ? $page->total() : $listings->sold($seller)->count(),
            ],
            'listings' => $isSold ? [] : ListingCardResource::cards($items, $request),
            'sold' => $isSold ? $items->map(fn (Listing $listing): array => (new SoldListingResource($listing))->resolve($request))->all() : [],
            'pagination' => ['page' => $page->currentPage(), 'pages' => max(1, $page->lastPage())],
        ]);
    }
}
