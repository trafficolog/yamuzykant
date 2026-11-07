<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Messaging\Actions\SendMessage;
use Inertia\Testing\AssertableInertia;
use Tests\Support\MessagingFixtures;

// Служебная страница для e2e «сообщение доходит до второй вкладки» до экрана сообщений (4.1.2):
// только local, testing, e2e.

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('продавцу создаёт опубликованное объявление без города (не попадает в выдачу); повторно — то же', function () {
    $seller = User::factory()->create();

    $this->actingAs($seller)->get('/_e2e/messaging')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Dev/MessagingPlayground')
            ->where('listingId', Listing::query()->sole()->id)
            ->where('conversation', null)
            ->has('messages', 0));

    $this->get('/_e2e/messaging')->assertOk();
    $listing = Listing::query()->sole();
    expect($listing->user_id)->toBe($seller->id)
        ->and($listing->status)->toBe(ListingStatus::Published)
        ->and($listing->city_id)->toBeNull();
});

it('участнику показывает беседу с сообщениями', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    app(SendMessage::class)->handle($buyer, $conversation, 'Здравствуйте');

    $this->actingAs($buyer)->get("/_e2e/messaging/{$conversation->id}")
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Dev/MessagingPlayground')
            ->where('conversation.id', $conversation->id)
            ->where('messages.0.body', 'Здравствуйте'));
});

it('чужую беседу не показывает: 404', function () {
    $conversation = MessagingFixtures::conversation();

    $this->actingAs(User::factory()->create())->get("/_e2e/messaging/{$conversation->id}")->assertNotFound();
});

it('гостя отправляет на главную', function () {
    $this->get('/_e2e/messaging')->assertRedirect('/');
});

it('в production и на stage — 404', function (string $environment) {
    app()->detectEnvironment(fn () => $environment);

    $this->actingAs(User::factory()->create())->get('/_e2e/messaging')->assertNotFound();
})->with(['production', 'stage']);
