<?php

declare(strict_types=1);

namespace App\Http\Controllers\Listings;

use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Queries\SimilarListings;
use App\Http\Controllers\Controller;
use App\Http\Resources\Listings\LotResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Страница объявления (UC-V1, 3.1.5): `/listings/{id}`. Не опубликованное видят только владелец и сотрудники,
 * остальным 404, как у отсутствующего (решение OWNER 07.11.2026, SPEC §6.1) — 403 выдал бы, что объявление есть.
 */
final class LotController extends Controller
{
    public function __invoke(Request $request, Listing $listing, SimilarListings $similar): Response
    {
        abort_unless(Gate::forUser($request->user())->allows('view', $listing), 404);

        $listing->load(['model', 'city', 'category.parent.parent', 'user.city', 'photos', 'saleRecord']);

        return Inertia::render('Lot/Show', (new LotResource($listing, $similar->for($listing)))->resolve($request));
    }
}
