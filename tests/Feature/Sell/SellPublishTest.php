<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Actions\PublishListing;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Events\ListingPublished;
use App\Domain\Listings\Exceptions\ListingLimitReached;
use App\Domain\Listings\Exceptions\PhotoRequirementsNotMet;
use App\Domain\Listings\Models\Listing;
use App\Domain\Moderation\Jobs\AssessListingRisk;
use App\Domain\Search\Jobs\SyncListingToIndex;
use App\Support\Flags\FeatureFlag;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia;
use Laravel\Pennant\Feature;

// UC-L1 п. 7 (задача 2.1.4): «Опубликовать» → автопроверки → published (премодерация выключена) или pending (включена).
// Данные формы и черновик с 3 фото — хелперы SellFormTest.

beforeEach(function () {
    config(['scout.driver' => 'null']);
    Feature::for(null)->deactivate(FeatureFlag::Premoderation->value);
});

/**
 * Содержимое формы для вызова действия публикации напрямую (в обход HTTP).
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function publishContent(int $categoryId, array $overrides = []): array
{
    return array_merge([
        'category_id' => $categoryId, 'title' => 'Fender Stratocaster', 'model_id' => null, 'year' => null,
        'serial' => null, 'condition' => 'excellent', 'description' => null,
        'price' => 100_000, 'negotiable' => false, 'meet' => true, 'ship' => false,
    ], $overrides);
}

/** @param  list<ListingStatus>  $statuses */
function sellFill(User $user, array $statuses): void
{
    foreach ($statuses as $status) {
        Listing::factory()->for($user)->inStatus($status)->create();
    }
}

describe('публикация без премодерации', function () {
    it('«Опубликовать» ведёт сразу в published, срок — 60 дней, экран «Опубликовано»', function () {
        [$owner, $kind, $draft] = sellCase();

        $this->actingAs($owner)
            ->post('/sell', sellPayload($draft, $kind))
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('sell.done', $draft));

        $listing = sellReload($draft);
        expect($listing->status)->toBe(ListingStatus::Published)
            ->and($listing->published_at)->not->toBeNull()
            ->and($listing->title)->toBe('Fender American Vintage ’57 Stratocaster')
            ->and((int) config('listings.expire_after_days'))->toBe(60)
            ->and($listing->expiresAt()?->toDateString())->toBe(now()->addDays(60)->toDateString());

        $this->get(route('sell.done', $draft))->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Sell/Published')
                ->where('status', 'published')
                ->where('listing.id', $draft->id)
                ->where('listing.title', 'Fender American Vintage ’57 Stratocaster')
                ->where('listing.url', "/listings/{$draft->id}")
                ->where('days', 60));
    });

    it('публикация ставит в очередь индексацию и автопроверку риска', function () {
        Queue::fake();
        [$owner, $kind, $draft] = sellCase();

        $this->actingAs($owner)->post('/sell', sellPayload($draft, $kind))->assertSessionHasNoErrors();

        Queue::assertPushed(SyncListingToIndex::class);
        Queue::assertPushed(AssessListingRisk::class);
    });

    it('двойное нажатие «Опубликовать»: одно объявление и одно событие публикации', function () {
        Event::fake([ListingPublished::class]);
        [$owner, $kind, $draft] = sellCase();

        $this->actingAs($owner)->post('/sell', sellPayload($draft, $kind))->assertRedirect(route('sell.done', $draft));
        $first = sellReload($draft)->published_at;
        $this->travel(5)->seconds();

        // Второй запрос, прошедший проверку формы до первого, ждёт блокировку и находит уже опубликованное.
        $again = app(PublishListing::class)(sellReload($draft), publishContent($kind->id), null);

        expect($again->status)->toBe(ListingStatus::Published)
            ->and(Listing::query()->where('user_id', $owner->id)->count())->toBe(1)
            ->and(sellReload($draft)->published_at?->equalTo($first))->toBeTrue()
            ->and(sellReload($draft)->price)->toBe(184_500);
        Event::assertDispatchedTimes(ListingPublished::class, 1);
    });

    it('повторный запрос после публикации не публикует заново и не портит объявление', function () {
        [$owner, $kind, $draft] = sellCase();
        $this->actingAs($owner)->post('/sell', sellPayload($draft, $kind));

        $this->actingAs($owner)->from('/sell')
            ->post('/sell', sellPayload($draft, $kind, ['price' => 1]))
            ->assertSessionHasErrors('listing_id');

        expect(sellReload($draft)->price)->toBe(184_500)
            ->and(Listing::query()->where('user_id', $owner->id)->count())->toBe(1);
    });

    it('при публикации режим цены черновика сбрасывается: у объявления остаётся только price', function () {
        [$owner, $kind, $draft] = sellCase();
        $this->actingAs($owner)->putJson('/sell/draft', ['listing_id' => $draft->id, 'price_mode' => 'negotiable'])->assertOk();
        expect(sellReload($draft)->draft_price_mode)->toBe('negotiable');

        $this->actingAs($owner)->post('/sell', sellPayload($draft, $kind, ['price_mode' => 'negotiable', 'price' => null]));

        expect(sellReload($draft)->draft_price_mode)->toBeNull()->and(sellReload($draft)->price)->toBeNull();
    });
});

describe('публикация с премодерацией (флаг premoderation)', function () {
    it('ведёт в pending: не в выдаче, экран «Отправлено на проверку»', function () {
        Feature::for(null)->activate(FeatureFlag::Premoderation->value);
        [$owner, $kind, $draft] = sellCase();

        $this->actingAs($owner)->post('/sell', sellPayload($draft, $kind))
            ->assertRedirect(route('sell.done', $draft));

        $listing = sellReload($draft);
        expect($listing->status)->toBe(ListingStatus::Pending)
            ->and($listing->published_at)->toBeNull()
            ->and($listing->shouldBeSearchable())->toBeFalse();

        $this->get(route('sell.done', $draft))
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Sell/Published')->where('status', 'pending'));
    });

    it('в запросе нельзя выбрать статус: published при включённом флаге всё равно pending', function () {
        Feature::for(null)->activate(FeatureFlag::Premoderation->value);
        [$owner, $kind, $draft] = sellCase();

        $this->actingAs($owner)->post('/sell', sellPayload($draft, $kind, ['status' => 'published']));

        expect(sellReload($draft)->status)->toBe(ListingStatus::Pending);
    });
});

describe('экран «Объявление опубликовано»', function () {
    it('чужое объявление и собственный черновик — 404', function () {
        [$owner, $kind, $draft] = sellCase();
        $foreign = Listing::factory()->for(User::factory()->create())->inStatus(ListingStatus::Published)->create();

        $this->actingAs($owner)->get(route('sell.done', $foreign))->assertNotFound();
        $this->actingAs($owner)->get(route('sell.done', $draft))->assertNotFound();
    });

    it('гостя отправляет на главную', function () {
        $listing = Listing::factory()->inStatus(ListingStatus::Published)->create();

        $this->get(route('sell.done', $listing))->assertRedirect('/');
    });
});

describe('автопроверки и фото перед публикацией (ревью PR #130)', function () {
    it('контакт в описании: публикации нет, черновик остаётся черновиком', function () {
        [$owner, $kind, $draft] = sellCase();

        $this->actingAs($owner)->from('/sell')
            ->post('/sell', sellPayload($draft, $kind, ['description' => 'Звоните +7 916 123-45-67']))
            ->assertSessionHasErrors('description');

        expect(sellReload($draft)->status)->toBe(ListingStatus::Draft)->and(sellReload($draft)->published_at)->toBeNull();
    });

    it('и вне HTTP: действие публикации само вызывает ListingAutoChecks::validate()', function () {
        [$owner, $kind, $draft] = sellCase();
        $content = publishContent($kind->id, ['description' => 'Пишите ivan@mail.ru']);

        expect(fn () => app(PublishListing::class)($draft, $content, null))->toThrow(ValidationException::class);
        expect(sellReload($draft)->status)->toBe(ListingStatus::Draft)->and(sellReload($draft)->description)->toBeNull();
    });

    it('и вне HTTP: фото проверяются до перехода статуса', function () {
        $owner = User::factory()->create();
        $kind = sellKind();
        $draft = sellDraft($owner, photos: 2);

        expect(fn () => app(PublishListing::class)($draft, publishContent($kind->id), null))
            ->toThrow(PhotoRequirementsNotMet::class);
        expect(sellReload($draft)->status)->toBe(ListingStatus::Draft);
    });
});

describe('лимит активных объявлений (BR-06)', function () {
    it('в конфиге 10; 11-е не публикуется, понятный отказ у формы, черновик с данными остаётся', function () {
        expect((int) config('listings.active_limit'))->toBe(10);
        [$owner, $kind, $draft] = sellCase();
        sellFill($owner, array_fill(0, 10, ListingStatus::Published));

        $this->actingAs($owner)->from('/sell')
            ->post('/sell', sellPayload($draft, $kind))
            ->assertRedirect('/sell')
            ->assertSessionHasErrors(['limit' => 'Достигнут лимит: 10 активных объявлений. Снимите одно с продажи, чтобы опубликовать новое.']);

        $listing = sellReload($draft);
        expect($listing->status)->toBe(ListingStatus::Draft)
            ->and($listing->title)->toBe('Fender American Vintage ’57 Stratocaster');
    });

    it('активные — published, pending и needs_changes; снятое, истёкшее, отклонённое и чужое место не занимают', function () {
        config(['listings.active_limit' => 3]);
        [$owner, $kind, $draft] = sellCase();
        sellFill($owner, [ListingStatus::Withdrawn, ListingStatus::Expired, ListingStatus::Rejected]);
        sellFill(User::factory()->create(), array_fill(0, 5, ListingStatus::Published));
        sellFill($owner, [ListingStatus::Published, ListingStatus::Pending]);

        $this->actingAs($owner)->post('/sell', sellPayload($draft, $kind))->assertSessionHasNoErrors();
        expect(sellReload($draft)->status)->toBe(ListingStatus::Published);

        $second = sellDraft($owner);
        $this->actingAs($owner)->from('/sell')->post('/sell', sellPayload($second, $kind))->assertSessionHasErrors('limit');
    });

    it('needs_changes занимает место, а снятие освобождает его', function () {
        config(['listings.active_limit' => 1]);
        [$owner, $kind, $draft] = sellCase();
        $held = Listing::factory()->for($owner)->inStatus(ListingStatus::NeedsChanges)->create();

        $this->actingAs($owner)->from('/sell')->post('/sell', sellPayload($draft, $kind))->assertSessionHasErrors('limit');

        DB::table('listings')->where('id', $held->id)->update(['status' => ListingStatus::Withdrawn->value]);
        $this->actingAs($owner)->post('/sell', sellPayload($draft, $kind))->assertSessionHasNoErrors();
        expect(sellReload($draft)->status)->toBe(ListingStatus::Published);
    });

    it('действие бросает ListingLimitReached с числами лимита, черновик остаётся', function () {
        config(['listings.active_limit' => 1]);
        [$owner, $kind, $draft] = sellCase();
        sellFill($owner, [ListingStatus::Published]);

        try {
            app(PublishListing::class)($draft, publishContent($kind->id), null);
            $this->fail('Лимит не сработал.');
        } catch (ListingLimitReached $e) {
            expect($e->used)->toBe(1)->and($e->limit)->toBe(1)
                ->and($e->getMessage())->toBe('Достигнут лимит: 1 активное объявление. Снимите одно с продажи, чтобы опубликовать новое.');
        }
        expect(sellReload($draft)->status)->toBe(ListingStatus::Draft);
    });
});
