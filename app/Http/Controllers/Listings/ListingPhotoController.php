<?php

declare(strict_types=1);

namespace App\Http\Controllers\Listings;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Actions\ConfirmPhotoUpload;
use App\Domain\Listings\Actions\DeleteListingPhoto;
use App\Domain\Listings\Actions\ReorderListingPhotos;
use App\Domain\Listings\Actions\RequestPhotoUpload;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Http\Controllers\Controller;
use App\Http\Requests\Listings\ConfirmPhotoUploadRequest;
use App\Http\Requests\Listings\ReorderPhotosRequest;
use App\Http\Requests\Listings\RequestPhotoUploadRequest;
use App\Http\Resources\Listings\ListingPhotoResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

/**
 * JSON-эндпоинты PhotoUploader (2.1.2). Права — ListingPolicy::update: владелец, черновик,
 * доработка или опубликованное объявление. Ошибки домена (PhotoRejected) — 422, bootstrap/app.php.
 */
final class ListingPhotoController extends Controller
{
    public function index(Listing $listing): AnonymousResourceCollection
    {
        Gate::authorize('update', $listing);

        return $this->photos($listing);
    }

    public function requestUpload(RequestPhotoUploadRequest $request, Listing $listing, RequestPhotoUpload $action): JsonResponse
    {
        Gate::authorize('update', $listing);

        [$upload, $ticket] = $action->handle($listing, $this->user($request), $request->contentType(), $request->size());

        return response()->json([
            'upload_id' => $upload->id,
            'url' => $ticket->url,
            'method' => $ticket->method,
            'headers' => $ticket->headers,
            'expires_at' => $ticket->expiresAt->toIso8601ZuluString(),
        ], 201);
    }

    public function store(ConfirmPhotoUploadRequest $request, Listing $listing, ConfirmPhotoUpload $action): JsonResponse
    {
        Gate::authorize('update', $listing);

        $photo = $action->handle($listing, $this->user($request), $request->uploadId(), $request->serial());

        return (new ListingPhotoResource($photo))->response()->setStatusCode(201);
    }

    public function reorder(ReorderPhotosRequest $request, Listing $listing, ReorderListingPhotos $action): AnonymousResourceCollection
    {
        Gate::authorize('update', $listing);

        $action->handle($listing, $request->ids());

        return $this->photos($listing);
    }

    public function destroy(Listing $listing, ListingPhoto $photo, DeleteListingPhoto $action): AnonymousResourceCollection
    {
        Gate::authorize('update', $listing);

        $action->handle($listing, $photo);

        return $this->photos($listing);
    }

    /** Серийное фото первым, затем по порядку — как ячейки PhotoUploader. */
    private function photos(Listing $listing): AnonymousResourceCollection
    {
        $photos = ListingPhoto::query()
            ->with('listing') // PhotoVisibility читает статус объявления: без этого запрос на каждое фото
            ->where('listing_id', $listing->id)
            ->orderByDesc('is_serial')
            ->orderBy('position')
            ->get();

        return ListingPhotoResource::collection($photos);
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }
}
