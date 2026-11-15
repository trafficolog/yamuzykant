<?php

declare(strict_types=1);

namespace App\Domain\Notifications\Listeners;

use App\Domain\Favorites\Models\Favorite;
use App\Domain\Listings\Events\ListingPriceDropped;
use App\Domain\Notifications\Enums\NotificationKind;
use App\Domain\Notifications\Mail\PriceDropMail;
use App\Domain\Notifications\NotificationPreferences;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Mail;

/**
 * Письма о снижении цены (4.3.1, UC-S5): каждому, у кого объявление в избранном и письма этого вида включены
 * (NotificationPreferences). Идёт в очереди после commit перехода (ListingPriceDropped — after commit).
 * Прежняя цена в письме — та, с которой пользователь добавил объявление (`favorites.price_at_save`).
 */
final class SendPriceDropEmails implements ShouldQueue
{
    public bool $afterCommit = true;

    public function handle(ListingPriceDropped $event): void
    {
        $listing = $event->listing;

        Favorite::query()
            ->where('listing_id', $listing->id)
            ->with('user')
            ->each(function (Favorite $favorite) use ($listing): void {
                $user = $favorite->user;

                if (NotificationPreferences::allows($user, NotificationKind::PriceDrop)) {
                    Mail::to($user->email)->send(new PriceDropMail($user, $listing, $favorite->price_at_save));
                }
            });
    }
}
