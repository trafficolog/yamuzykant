<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use Inertia\Testing\AssertableInertia;

// Служебная страница для e2e «загрузка 3 фото» до формы «Продать» (2.1.3): только local, testing, e2e.

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('показывает загрузчик с черновиком пользователя; повторный заход — тот же черновик', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get('/_e2e/photo-uploader')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Dev/PhotoUploader')
            ->where('listingId', Listing::query()->sole()->id)
            ->has('photos', 0));

    $this->get('/_e2e/photo-uploader')->assertOk();
    $listing = Listing::query()->sole();
    expect($listing->user_id)->toBe($user->id)
        ->and($listing->status)->toBe(ListingStatus::Draft);
});

it('гостя отправляет на главную', function () {
    $this->get('/_e2e/photo-uploader')->assertRedirect('/');
});

it('в production и на stage — 404', function (string $environment) {
    app()->detectEnvironment(fn () => $environment);

    $this->actingAs(User::factory()->create())->get('/_e2e/photo-uploader')->assertNotFound();
})->with(['production', 'stage']);
