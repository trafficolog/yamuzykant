<?php

declare(strict_types=1);

use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use App\Domain\Moderation\AutoChecks\ListingAutoChecks;
use App\Domain\Moderation\Enums\RiskLevel;
use App\Domain\Moderation\Jobs\AssessListingRisk;
use App\Domain\Moderation\Models\ModerationFlag;
use App\Support\Flags\FeatureFlag;
use Illuminate\Support\Facades\Queue;
use Laravel\Pennant\Feature;

// UC-O1 (задача 5.1.1): после публикации и существенной правки автопроверки идут в очереди,
// флаги и риск сохраняются в moderation_flags с пояснением. Показ модератору — 5.1.2.

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('чистое объявление: флаг с риском normal и без сигналов', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create();

    (new AssessListingRisk($listing->id))->handle(app(ListingAutoChecks::class));

    $flag = ModerationFlag::query()->where('listing_id', $listing->id)->sole();
    expect($flag->risk)->toBe(RiskLevel::Normal)->and($flag->signals)->toBe([]);
});

it('признаки сохраняются с кодом, полем и пояснением; риск high', function () {
    config(['moderation.stop_words' => ['предоплата']]);
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['description' => 'Только предоплата']);

    AssessListingRisk::dispatchSync($listing->id);

    $flag = ModerationFlag::query()->where('listing_id', $listing->id)->sole();
    expect($flag->risk)->toBe(RiskLevel::High)
        ->and($flag->signals)->toHaveCount(1)
        ->and($flag->signals[0])->toMatchArray(['code' => 'stop_words', 'field' => 'description'])
        ->and($flag->signals[0]['message'])->toContain('предоплата');
});

it('повторный запуск обновляет флаг, а не добавляет второй', function () {
    config(['moderation.stop_words' => ['предоплата']]);
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['description' => 'Только предоплата']);
    AssessListingRisk::dispatchSync($listing->id);

    $listing->forceFill(['description' => 'Родной кейс'])->save();
    AssessListingRisk::dispatchSync($listing->id);

    $flag = ModerationFlag::query()->where('listing_id', $listing->id)->sole();
    expect($flag->risk)->toBe(RiskLevel::Normal)->and($flag->signals)->toBe([]);
});

it('черновик и несуществующее объявление не проверяются', function () {
    $draft = Listing::factory()->create(['description' => 'Звоните 89161234567']);

    AssessListingRisk::dispatchSync($draft->id);
    AssessListingRisk::dispatchSync('00000000-0000-0000-0000-000000000000');

    expect(ModerationFlag::query()->count())->toBe(0);
});

it('флаги удаляются вместе с объявлением', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Published)->create();
    AssessListingRisk::dispatchSync($listing->id);

    $listing->delete();

    expect(ModerationFlag::query()->count())->toBe(0);
});

describe('постановка в очередь', function () {
    /** Черновик готов к публикации: фото не нужны машине статусов. */
    function readyDraft(): Listing
    {
        $listing = Listing::factory()->create();
        ListingPhoto::query()->create(['listing_id' => $listing->id, 'path' => 'p', 'position' => 0, 'is_serial' => true]);

        return $listing;
    }

    it('публикация без премодерации ставит автопроверки в очередь', function () {
        Queue::fake();

        app(ListingStateMachine::class)->publish(readyDraft());

        Queue::assertPushed(AssessListingRisk::class, 1);
    });

    it('публикация с премодерацией (pending) тоже ставит автопроверки в очередь', function () {
        Feature::for(null)->activate(FeatureFlag::Premoderation->value);
        Queue::fake();

        $listing = app(ListingStateMachine::class)->publish(readyDraft());

        expect($listing->status)->toBe(ListingStatus::Pending);
        Queue::assertPushed(AssessListingRisk::class, 1);
    });

    it('в job уходит id опубликованного объявления', function () {
        Queue::fake();

        $listing = app(ListingStateMachine::class)->publish(readyDraft());

        Queue::assertPushed(AssessListingRisk::class, fn (AssessListingRisk $job): bool => $job->listingId === $listing->id);
    });

    it('существенная правка опубликованного ставит проверки, несущественная и снижение цены — нет', function () {
        Queue::fake();
        $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['price' => 100_000]);
        $machine = app(ListingStateMachine::class);

        $machine->edit($listing, ['year' => 1962]);
        $machine->edit($listing, ['price' => 90_000]);
        Queue::assertNotPushed(AssessListingRisk::class);

        $machine->edit($listing, ['description' => 'Новое описание']);
        Queue::assertPushed(AssessListingRisk::class, 1);
    });

    it('повторная отправка после доработки ставит проверки', function () {
        Queue::fake();
        $listing = Listing::factory()->inStatus(ListingStatus::NeedsChanges)->create();

        app(ListingStateMachine::class)->resubmit($listing);

        Queue::assertPushed(AssessListingRisk::class, 1);
    });

    it('снятие, одобрение и истечение проверок не ставят', function () {
        Queue::fake();
        $machine = app(ListingStateMachine::class);

        $machine->expire(Listing::factory()->inStatus(ListingStatus::Published)->create());
        $machine->approve(Listing::factory()->inStatus(ListingStatus::Pending)->create());

        Queue::assertNotPushed(AssessListingRisk::class);
    });
});
