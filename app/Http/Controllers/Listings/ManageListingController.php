<?php

declare(strict_types=1);

namespace App\Http\Controllers\Listings;

use App\Domain\Catalog\Exceptions\SuggestionLimitReached;
use App\Domain\Catalog\Queries\CurrentCity;
use App\Domain\Listings\Actions\UpdateListing;
use App\Domain\Listings\Exceptions\IllegalTransition;
use App\Domain\Listings\Exceptions\ListingLimitReached;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use App\Http\Controllers\Controller;
use App\Http\Requests\Listings\LowerPriceRequest;
use App\Http\Requests\Listings\UpdateListingRequest;
use App\Http\Requests\Listings\WithdrawListingRequest;
use App\Http\Resources\Listings\ListingFormProps;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

/**
 * Управление своим объявлением из кабинета (UC-L3, UC-L4, 2.1.5): изменить той же формой, снизить цену,
 * снять с продажи, вернуть в продажу, продлить. Вход — middleware `auth`; права — ListingPolicy (чужое — 404, своё в неподходящем статусе — 403).
 * Статус меняет только ListingStateMachine.
 */
final class ManageListingController extends Controller
{
    /** Форма «Изменить»: Sell/Create с содержимым опубликованного объявления. */
    public function edit(Request $request, Listing $listing, CurrentCity $currentCity): Response
    {
        Gate::authorize('edit', $listing);
        $place = $currentCity->for($request);

        return Inertia::render('Sell/Create', [
            'mode' => 'edit',
            'listingId' => $listing->id,
            'photos' => ListingFormProps::photos($listing, $request),
            'draft' => ListingFormProps::for($listing),
            'place' => $place === null ? null : ['type' => $place->settlement_type, 'name' => $place->name],
        ]);
    }

    public function update(UpdateListingRequest $request, Listing $listing, UpdateListing $update): RedirectResponse
    {
        try {
            $update($listing, $request->content());
        } catch (SuggestionLimitReached $e) {
            return back()->withErrors(['title' => $e->getMessage()]);
        } catch (IllegalTransition) {
            return back()->withErrors(['listing' => (string) __('listings.manage.messages.changed')]);
        }

        return redirect()->route('account.listings');
    }

    public function lowerPrice(LowerPriceRequest $request, Listing $listing, ListingStateMachine $machine): RedirectResponse
    {
        try {
            $machine->edit($listing, ['price' => $request->price()]);
        } catch (IllegalTransition) {
            return back()->withErrors(['price' => (string) __('listings.manage.messages.changed')]);
        }

        return back();
    }

    public function withdraw(WithdrawListingRequest $request, Listing $listing, ListingStateMachine $machine): RedirectResponse
    {
        try {
            $machine->withdraw($listing, $request->reason(), $request->finalPrice());
        } catch (InvalidArgumentException $e) {
            // «Продал на ЯМузыканте» и итоговая цена — только для опубликованного (решение OWNER по UC-L4).
            return back()->withErrors(['reason' => $e->getMessage()]);
        } catch (IllegalTransition) {
            return back()->withErrors(['listing' => (string) __('listings.manage.messages.changed')]);
        }

        return back();
    }

    public function relist(Listing $listing, ListingStateMachine $machine): RedirectResponse
    {
        Gate::authorize('relist', $listing);

        return $this->restore(fn () => $machine->relist($listing));
    }

    public function renew(Listing $listing, ListingStateMachine $machine): RedirectResponse
    {
        Gate::authorize('renew', $listing);

        return $this->restore(fn () => $machine->renew($listing));
    }

    /** Возврат в активные (relist, renew): BR-06 — понятный отказ, статус прежний. */
    private function restore(callable $transition): RedirectResponse
    {
        try {
            $transition();
        } catch (ListingLimitReached $e) {
            return back()->withErrors(['limit' => trans_choice('listings.manage.limit_restore', $e->limit, ['count' => $e->limit])]);
        } catch (IllegalTransition) {
            return back()->withErrors(['listing' => (string) __('listings.manage.messages.changed')]);
        }

        return back();
    }
}
