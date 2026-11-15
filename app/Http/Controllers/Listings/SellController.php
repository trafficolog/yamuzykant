<?php

declare(strict_types=1);

namespace App\Http\Controllers\Listings;

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Exceptions\SuggestionLimitReached;
use App\Domain\Catalog\Queries\CurrentCity;
use App\Domain\Listings\Actions\AutosaveListingDraft;
use App\Domain\Listings\Actions\FindOrCreateDraft;
use App\Domain\Listings\Actions\PublishListing;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Exceptions\ListingLimitReached;
use App\Domain\Listings\Exceptions\PhotoRequirementsNotMet;
use App\Domain\Listings\Models\Listing;
use App\Http\Controllers\Controller;
use App\Http\Requests\Listings\SaveDraftRequest;
use App\Http\Requests\Listings\StoreListingRequest;
use App\Http\Resources\Listings\ListingFormProps;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Экран «Продать инструмент» (UC-L1). Вход — middleware `auth` на маршруте.
 * Черновик создаётся при открытии страницы: к нему привязываются фото. Форма восстанавливается из черновика,
 * автосохранение пишет его через PUT /sell/draft, «Опубликовать» — POST /sell (PublishListing) и экран результата.
 */
final class SellController extends Controller
{
    public function create(Request $request, FindOrCreateDraft $findOrCreate, CurrentCity $currentCity): Response
    {
        /** @var User $user */
        $user = $request->user();
        Gate::authorize('create', Listing::class);

        $draft = $findOrCreate($user);
        $place = $currentCity->for($request);

        return Inertia::render('Sell/Create', [
            'listingId' => $draft->id,
            'photos' => ListingFormProps::photos($draft, $request),
            'draft' => ListingFormProps::for($draft),
            // «Встреча в г. Москва»: тип населённого пункта и название города шапки, без склонения (решение OWNER 08.11.2026).
            'place' => $place === null ? null : ['type' => $place->settlement_type, 'name' => $place->name],
        ]);
    }

    /** «Опубликовать»: блокирующие автопроверки и фото → published (или pending с флагом premoderation) → экран результата. */
    public function store(StoreListingRequest $request, PublishListing $publish, CurrentCity $currentCity): RedirectResponse
    {
        $listing = Listing::query()->whereKey((string) $request->validated('listing_id'))->firstOrFail();
        Gate::authorize('update', $listing);

        // Город — из шапки (BR-01), а не из запроса.
        try {
            $publish($listing, $request->content(), $currentCity->for($request)?->id);
        } catch (SuggestionLimitReached $e) {
            // Общий суточный лимит предложений моделей (1.2.2): ошибка у названия, черновик не публикуется.
            return back()->withErrors(['title' => $e->getMessage()]);
        } catch (PhotoRequirementsNotMet $e) {
            return back()->withErrors(['photos' => $e->getMessage()]);
        } catch (ListingLimitReached $e) {
            // BR-06: черновик остаётся заполненным, продавец видит, что сделать.
            return back()->withErrors(['limit' => $e->getMessage()]);
        }

        return redirect()->route('sell.done', $listing);
    }

    /** Автосохранение (каждые 5 с, при уходе со страницы) и «Сохранить черновик»: JSON, любое подмножество полей. */
    public function saveDraft(SaveDraftRequest $request, AutosaveListingDraft $autosave, CurrentCity $currentCity): JsonResponse
    {
        $listing = Listing::query()->whereKey((string) $request->validated('listing_id'))->firstOrFail();
        Gate::authorize('update', $listing);

        $saved = $autosave($listing, $request->content(), $currentCity->for($request)?->id);

        return response()->json(['saved_at' => $saved->updated_at?->toIso8601String()]);
    }

    /** Экран «Объявление опубликовано» / «Отправлено на проверку» — только владельцу и только после публикации. */
    public function done(Listing $listing): Response
    {
        Gate::authorize('viewResult', $listing);

        return Inertia::render('Sell/Published', [
            'status' => $listing->status === ListingStatus::Published ? 'published' : 'pending',
            'listing' => [
                'id' => $listing->id,
                'title' => $listing->title,
                'url' => route('lot.show', ['listing' => $listing->id], absolute: false),
            ],
            'days' => (int) config('listings.expire_after_days'),
        ]);
    }
}
