<?php

declare(strict_types=1);

namespace App\Http\Controllers\Listings;

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Queries\CurrentCity;
use App\Domain\Listings\Actions\FindOrCreateDraft;
use App\Domain\Listings\Actions\SaveListingDraft;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Http\Controllers\Controller;
use App\Http\Requests\Listings\StoreListingRequest;
use App\Http\Resources\Listings\ListingPhotoResource;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Экран «Продать инструмент» (UC-L1, 2.1.3). Вход — middleware `auth` на маршруте.
 * Черновик создаётся при открытии страницы: к нему привязываются фото. Публикация — 2.1.4.
 */
final class SellController extends Controller
{
    public function create(Request $request, FindOrCreateDraft $findOrCreate): Response
    {
        /** @var User $user */
        $user = $request->user();
        Gate::authorize('create', Listing::class);

        $draft = $findOrCreate($user);
        $photos = ListingPhoto::query()
            ->where('listing_id', $draft->id)
            ->orderByDesc('is_serial')
            ->orderBy('position')
            ->get();

        return Inertia::render('Sell/Create', [
            'listingId' => $draft->id,
            'photos' => ListingPhotoResource::collection($photos)->resolve($request),
            'saved' => (bool) $request->session()->get('sell_saved', false),
        ]);
    }

    public function store(StoreListingRequest $request, SaveListingDraft $save, CurrentCity $currentCity): RedirectResponse
    {
        $listing = Listing::query()->whereKey((string) $request->validated('listing_id'))->firstOrFail();
        Gate::authorize('update', $listing);

        // Город — из шапки (BR-01), а не из запроса.
        $save($listing, $request->content(), $currentCity->for($request)?->id);

        return redirect()->route('sell')->with('sell_saved', true);
    }
}
