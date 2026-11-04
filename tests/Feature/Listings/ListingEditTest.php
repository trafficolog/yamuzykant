<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\City;
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

    $listing->refresh();
    expect($listing->status)->toBe(ListingStatus::Published)
        ->and($listing->price)->toBe(170_000);
    Event::assertDispatched(ListingPriceDropped::class);
})->with('premoderation');

it('год, город, цена вверх, торг, способы передачи — несущественная правка, статус published', function (string $field, bool $premoderation) {
    $premoderation ? Feature::for(null)->activate(FeatureFlag::Premoderation->value) : null;
    Event::fake();
    $listing = publishedStrat();
    $changes = match ($field) {
        'year' => ['year' => 1962],
        'city_id' => ['city_id' => City::factory()->create()->id],
        'price' => ['price' => 190_000],
        'negotiable' => ['negotiable' => ! $listing->negotiable],
        'meet' => ['meet' => false],
        default => ['ship' => true],
    };

    app(ListingStateMachine::class)->edit($listing, $changes);

    expect($listing->fresh()?->status)->toBe(ListingStatus::Published);
    Event::assertDispatched(ListingMinorEdited::class);
    Event::assertNotDispatched(ListingSubstantiallyEdited::class);
})->with(['year', 'city_id', 'price', 'negotiable', 'meet', 'ship'])->with('premoderation');

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

it('модель, категория, название, серийный номер, описание, состояние — существенная правка', function (string $field, bool $premoderation) {
    $premoderation ? Feature::for(null)->activate(FeatureFlag::Premoderation->value) : null;
    Event::fake();
    $listing = publishedStrat();
    $changes = match ($field) {
        'model_id' => ['model_id' => InstrumentModel::factory()->create()->id],
        'category_id' => ['category_id' => Category::factory()->create()->id],
        'title' => ['title' => 'Fender ’62 Stratocaster'],
        'serial_enc' => ['serial_enc' => 'L123456'],
        'description' => ['description' => 'Переделан звукосниматель.'],
        default => ['condition' => Condition::Good],
    };

    app(ListingStateMachine::class)->edit($listing, $changes);

    expect($listing->fresh()?->status)->toBe($premoderation ? ListingStatus::Pending : ListingStatus::Published);
    Event::assertDispatched(ListingSubstantiallyEdited::class);
})->with(['model_id', 'category_id', 'title', 'serial_enc', 'description', 'condition'])->with('premoderation');

it('существенная правка вместе со снижением цены — существенная', function () {
    Feature::for(null)->activate(FeatureFlag::Premoderation->value);
    Event::fake();
    $listing = publishedStrat();

    app(ListingStateMachine::class)->edit($listing, ['price' => 170_000, 'description' => 'Новый текст']);

    $listing->refresh();
    expect($listing->status)->toBe(ListingStatus::Pending)
        ->and($listing->price)->toBe(170_000)
        ->and($listing->description)->toBe('Новый текст');
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

it('правка принимает только поля содержания: владелец, статус, даты и id — отказ', function (string $field) {
    $listing = publishedStrat();
    $owner = $listing->user_id;
    $other = User::factory()->create();
    $value = match ($field) {
        'user_id' => $other->id,
        'status' => 'rejected',
        'published_at' => '2020-01-01 00:00:00',
        'id' => '00000000-0000-0000-0000-000000000000',
        default => '2020-01-01 00:00:00',
    };

    expect(fn () => app(ListingStateMachine::class)->edit($listing, [$field => $value, 'price' => 180_000]))
        ->toThrow(InvalidArgumentException::class);

    $listing->refresh();
    expect($listing->user_id)->toBe($owner)
        ->and($listing->status)->toBe(ListingStatus::Published)
        ->and($listing->price)->toBe(184_500);
})->with(['user_id', 'status', 'published_at', 'id', 'created_at']);

it('правка с чужим user_id не меняет владельца', function () {
    $listing = publishedStrat();
    $owner = $listing->user_id;

    try {
        app(ListingStateMachine::class)->edit($listing, ['user_id' => User::factory()->create()->id]);
    } catch (InvalidArgumentException) {
        // ожидаемо
    }

    expect($listing->fresh()?->user_id)->toBe($owner);
});

it('отрицательная цена в правке — отказ', function () {
    $listing = publishedStrat();

    expect(fn () => app(ListingStateMachine::class)->edit($listing, ['price' => -1]))
        ->toThrow(InvalidArgumentException::class);
    expect($listing->fresh()?->price)->toBe(184_500);
});

it('цена 0 допустима (отдам даром) и считается снижением', function () {
    Event::fake();
    $listing = publishedStrat();

    app(ListingStateMachine::class)->edit($listing, ['price' => 0]);

    expect($listing->fresh()?->price)->toBe(0);
    Event::assertDispatched(ListingPriceDropped::class);
});
