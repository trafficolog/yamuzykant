<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Favorites\Models\Favorite;
use App\Domain\Listings\Enums\ListingEvent;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Events\ListingPriceDropped;
use App\Domain\Listings\Models\Listing;
use App\Domain\Notifications\Enums\NotificationKind;
use App\Domain\Notifications\Mail\PriceDropMail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;

// 4.3.1: письмо о снижении цены (шаблон 4.4.1) — тем, у кого объявление в избранном и письма этого вида включены.

beforeEach(function () {
    config(['scout.driver' => 'null', 'app.url' => 'https://yamuzykant.test']);
    URL::forceRootUrl('https://yamuzykant.test');
});

function dropPrice(Listing $listing, int $to): void
{
    $listing->forceFill(['price' => $to])->saveQuietly();
    event(new ListingPriceDropped($listing, ListingStatus::Published, ListingStatus::Published, ListingEvent::PriceDrop));
}

function watcher(Listing $listing, ?int $savedPrice = null, array $attributes = []): User
{
    $user = User::factory()->create($attributes);
    Favorite::query()->create(['user_id' => $user->id, 'listing_id' => $listing->id, 'price_at_save' => $savedPrice ?? $listing->price]);

    return $user;
}

it('вид письма: price_drop, по умолчанию включён', function () {
    expect(NotificationKind::PriceDrop->value)->toBe('price_drop')->and(NotificationKind::PriceDrop->enabledByDefault())->toBeTrue();
});

it('снижение цены — письмо тем, у кого объявление в избранном, и только им', function () {
    Mail::fake();
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['price' => 100_000]);
    $fan = watcher($listing);
    $stranger = User::factory()->create();

    dropPrice($listing, 90_000);

    Mail::assertSent(PriceDropMail::class, 1);
    Mail::assertSent(PriceDropMail::class, fn (PriceDropMail $mail): bool => $mail->hasTo($fan->email) && ! $mail->hasTo($stranger->email));
});

it('письма выключены в профиле — письма нет', function () {
    Mail::fake();
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['price' => 100_000]);
    watcher($listing, attributes: ['notification_prefs' => ['price_drop' => false]]);

    dropPrice($listing, 90_000);

    Mail::assertNothingSent();
});

it('каждому, у кого объявление в избранном, — своё письмо', function () {
    Mail::fake();
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['price' => 100_000]);
    watcher($listing);
    watcher($listing);

    dropPrice($listing, 90_000);

    Mail::assertSent(PriceDropMail::class, 2);
});

it('состав письма: название, новая цена, прежняя, ссылка на лот, причина и отписка', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['title' => 'Fender Stratocaster', 'price' => 90_000]);
    $user = watcher($listing, 120_000);

    $mail = new PriceDropMail($user, $listing, 120_000);

    $mail->assertSeeInOrderInHtml([
        'ЯМузыкант',
        'Цена снижена',
        'Fender Stratocaster',
        "90\u{00A0}000\u{00A0}₽",
        "120\u{00A0}000\u{00A0}₽",
        'Открыть объявление',
        'Письмо о снижении цен',
        'Отписаться',
    ]);
    $mail->assertSeeInHtml("/listings/{$listing->id}");
    $mail->assertSeeInHtml("/notifications/unsubscribe/{$user->id}/price_drop");
    $mail->assertHasSubject('Цена снижена: Fender Stratocaster');
    expect($mail->headers()->text['List-Unsubscribe-Post'])->toBe('List-Unsubscribe=One-Click');
});

it('в письме нет почты получателя и продавца', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['price' => 90_000]);
    $listing->user->forceFill(['email' => 'seller-private@example.test'])->save();
    $user = watcher($listing, 120_000, ['email' => 'fan-private@example.test']);

    (new PriceDropMail($user, $listing, 120_000))
        ->assertDontSeeInHtml('seller-private@example.test')
        ->assertDontSeeInHtml('fan-private@example.test');
});

it('отписка по подписанной ссылке выключает письма о снижении цены', function () {
    $user = User::factory()->create(['notification_prefs' => null]);

    $this->post(NotificationKind::PriceDrop->unsubscribeUrl($user))->assertOk();

    expect($user->refresh()->notification_prefs)->toBe(['new_message' => true, 'price_drop' => false]);
});
