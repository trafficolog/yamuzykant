<?php

declare(strict_types=1);

namespace App\Http\Controllers\Dev;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Http\Controllers\Controller;
use App\Http\Resources\Listings\ListingPhotoResource;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Служебная страница PhotoUploader для e2e (UC-L1 «загрузка 3 фото») до формы «Продать» (2.1.3).
 * Только local, testing и e2e; на stage и в production — 404.
 */
final class PhotoUploaderPlaygroundController extends Controller
{
    public function __invoke(Request $request): Response
    {
        abort_unless(app()->environment(['local', 'testing', 'e2e']), 404);

        /** @var User $user */
        $user = $request->user();
        $listing = Listing::query()->where('user_id', $user->id)->where('status', ListingStatus::Draft->value)->oldest()->first();
        if ($listing === null) {
            $listing = new Listing;
            $listing->user_id = $user->id;
            $listing->save();
        }

        $photos = ListingPhoto::query()->where('listing_id', $listing->id)->orderByDesc('is_serial')->orderBy('position')->get();

        return Inertia::render('Dev/PhotoUploader', [
            'listingId' => $listing->id,
            'photos' => ListingPhotoResource::collection($photos)->resolve($request),
        ]);
    }
}
