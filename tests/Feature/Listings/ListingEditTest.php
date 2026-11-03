<?php

declare(strict_types=1);

use App\Domain\Catalog\Models\InstrumentModel;
use App\Domain\Listings\Enums\Condition;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Events\ListingMinorEdited;
use App\Domain\Listings\Events\ListingPriceDropped;
use App\Domain\Listings\Events\ListingSubstantiallyEdited;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use App\Support\Flags\FeatureFlag;
use Illuminate\Support\Facades\Event;
use Laravel\Pennant\Feature;

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

function publishedStrat(): Listing
{
    return Listing::factory()->inStatus(ListingStatus::Published)->create([
        'price' => 184_500,
        'meet' => true,
        'ship' => false,
        'condition' => Condition::Excellent,
        'description' => 'Оригинальный корпус, родной кейс.',
    ]);
}

dataset('premoderation', ['флаг включён' => [true], 'флаг выключен' => [false]]);

it('снижение цены у published не меняет статус при любом значении флага', function (bool $premoderation) {
    $premoderation ? Feature::for(null)->activate(FeatureFlag::Premoderation->value) : null;
    Event::fake();
    $listing = publishedStrat();

    app(ListingStateMachine::class)->edit($listing, ['price' => 170_000]);

    expect($listing->fresh())
        ->status->toBe(ListingStatus::Published)
        ->price->toBe(170_000);
    Event::assertDispatched(ListingPriceDropped::class);
})->with('premoderation');

it('способы передачи, торг и цена вверх — несущественная правка, статус published', function (array $changes, bool $premoderation) {
    $premoderation ? Feature::for(null)->activate(FeatureFlag::Premoderation->value) : null;
    Event::fake();
    $listing = publishedStrat();

    app(ListingStateMachine::class)->edit($listing, $changes);

    expect($listing->fresh()?->status)->toBe(ListingStatus::Published);
    Event::assertDispatched(ListingMinorEdited::class);
    Event::assertNotDispatched(ListingSubstantiallyEdited::class);
})->with([
    'доставка' => [['ship' => true]],
    'встреча' => [['meet' => false]],
    'готов к торгу' => [['negotiable' => true]],
    'цена вверх' => [['price' => 190_000]],
])->with('premoderation');

it('изменение фото переводит в pending только при включённом premoderation', function (bool $premoderation, ListingStatus $expected) {
    $premoderation ? Feature::for(null)->activate(FeatureFlag::Premoderation->value) : null;
    Event::fake();
    $listing = publishedStrat();

    app(ListingStateMachine::class)->edit($listing, [], photosChanged: true);

    expect($listing->fresh()?->status)->toBe($expected);
    Event::assertDispatched(ListingSubstantiallyEdited::class);
})->with(fn (): array => [
    'флаг включён' => [true, ListingStatus::Pending],
    'флаг выключен' => [false, ListingStatus::Published],
]);

it('модель, описание, состояние — существенная правка', function (string $field, bool $premoderation) {
    $premoderation ? Feature::for(null)->activate(FeatureFlag::Premoderation->value) : null;
    Event::fake();
    $listing = publishedStrat();
    $changes = match ($field) {
        'model_id' => ['model_id' => InstrumentModel::factory()->create()->id],
        'description' => ['description' => 'Переделан звукосниматель.'],
        'condition' => ['condition' => Condition::Good],
    };

    app(ListingStateMachine::class)->edit($listing, $changes);

    expect($listing->fresh()?->status)->toBe($premoderation ? ListingStatus::Pending : ListingStatus::Published);
    Event::assertDispatched(ListingSubstantiallyEdited::class);
})->with(['model_id', 'description', 'condition'])->with('premoderation');

it('существенная правка вместе со снижением цены — существенная', function () {
    Feature::for(null)->activate(FeatureFlag::Premoderation->value);
    Event::fake();
    $listing = publishedStrat();

    app(ListingStateMachine::class)->edit($listing, ['price' => 170_000, 'description' => 'Новый текст']);

    expect($listing->fresh())
        ->status->toBe(ListingStatus::Pending)
        ->price->toBe(170_000)
        ->description->toBe('Новый текст');
    Event::assertDispatched(ListingSubstantiallyEdited::class);
    Event::assertNotDispatched(ListingPriceDropped::class);
});

it('то же значение поля — не изменение', function () {
    Feature::for(null)->activate(FeatureFlag::Premoderation->value);
    Event::fake();
    $listing = publishedStrat();

    app(ListingStateMachine::class)->edit($listing, ['description' => 'Оригинальный корпус, родной кейс.', 'condition' => 'excellent']);

    expect($listing->fresh()?->status)->toBe(ListingStatus::Published);
    Event::assertDispatched(ListingMinorEdited::class);
});

it('статус через правку не меняется: поле status игнорируется', function () {
    $listing = publishedStrat();

    app(ListingStateMachine::class)->edit($listing, ['status' => 'rejected', 'price' => 180_000]);

    expect($listing->fresh())
        ->status->toBe(ListingStatus::Published)
        ->price->toBe(180_000);
});
