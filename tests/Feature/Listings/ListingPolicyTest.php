<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Accounts\Staff\NoStaff;
use App\Domain\Accounts\Staff\StaffDirectory;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use Illuminate\Support\Facades\Gate;

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

/** Сотрудник-подмена: пока нет staff-guard (5.3.1), сотрудника определяет StaffDirectory. */
function actAsStaffDirectory(User $staff): void
{
    app()->instance(StaffDirectory::class, new class($staff) implements StaffDirectory
    {
        public function __construct(private readonly User $staff) {}

        public function isStaff(User $user): bool
        {
            return $user->is($this->staff);
        }
    });
}

it('по умолчанию сотрудников нет: заглушка до staff-guard', function () {
    expect(app(StaffDirectory::class))->toBeInstanceOf(NoStaff::class)
        ->and(app(StaffDirectory::class)->isStaff(User::factory()->create()))->toBeFalse();
});

it('гость и любой пользователь видят только опубликованное', function (ListingStatus $status, bool $visible) {
    $listing = Listing::factory()->inStatus($status)->create();
    $stranger = User::factory()->create();

    expect(Gate::forUser(null)->allows('view', $listing))->toBe($visible)
        ->and(Gate::forUser($stranger)->allows('view', $listing))->toBe($visible);
})->with(fn (): array => [
    [ListingStatus::Draft, false],
    [ListingStatus::Pending, false],
    [ListingStatus::Published, true],
    [ListingStatus::NeedsChanges, false],
    [ListingStatus::Rejected, false],
    [ListingStatus::Withdrawn, false],
    [ListingStatus::Expired, false],
]);

it('владелец и сотрудник видят объявление в любом статусе', function (ListingStatus $status) {
    $listing = Listing::factory()->inStatus($status)->create();
    $staff = User::factory()->create();
    actAsStaffDirectory($staff);

    expect(Gate::forUser($listing->user)->allows('view', $listing))->toBeTrue()
        ->and(Gate::forUser($staff)->allows('view', $listing))->toBeTrue();
})->with(fn (): array => ListingStatus::cases());

it('подать объявление может вошедший пользователь, гость — нет', function () {
    expect(Gate::forUser(User::factory()->create())->allows('create', Listing::class))->toBeTrue()
        ->and(Gate::forUser(null)->allows('create', Listing::class))->toBeFalse();
});

it('менять объявление может только владелец — в черновике, на доработке и опубликованное', function (ListingStatus $status, bool $allowed) {
    $listing = Listing::factory()->inStatus($status)->create();
    $staff = User::factory()->create();
    actAsStaffDirectory($staff);

    expect(Gate::forUser($listing->user)->allows('update', $listing))->toBe($allowed)
        ->and(Gate::forUser(User::factory()->create())->allows('update', $listing))->toBeFalse()
        ->and(Gate::forUser($staff)->allows('update', $listing))->toBeFalse()
        ->and(Gate::forUser(null)->allows('update', $listing))->toBeFalse();
})->with(fn (): array => [
    [ListingStatus::Draft, true],
    [ListingStatus::Pending, false],
    [ListingStatus::Published, true],
    [ListingStatus::NeedsChanges, true],
    [ListingStatus::Rejected, false],
    [ListingStatus::Withdrawn, false],
    [ListingStatus::Expired, false],
]);

it('действия продавца — только владельцу и только из допустимого статуса', function (string $ability, ListingStatus $allowedFrom) {
    foreach (ListingStatus::cases() as $status) {
        $listing = Listing::factory()->inStatus($status)->create();

        expect(Gate::forUser($listing->user)->allows($ability, $listing))->toBe($status === $allowedFrom, "{$ability} из {$status->value}")
            ->and(Gate::forUser(User::factory()->create())->allows($ability, $listing))->toBeFalse()
            ->and(Gate::forUser(null)->allows($ability, $listing))->toBeFalse();
    }
})->with(fn (): array => [
    ['publish', ListingStatus::Draft],
    ['resubmit', ListingStatus::NeedsChanges],
    ['withdraw', ListingStatus::Published],
    ['renew', ListingStatus::Expired],
    ['relist', ListingStatus::Withdrawn],
]);

it('решение модерации — только сотрудник и только по объявлению на проверке', function (ListingStatus $status, bool $allowed) {
    $listing = Listing::factory()->inStatus($status)->create();
    $staff = User::factory()->create();
    actAsStaffDirectory($staff);

    expect(Gate::forUser($staff)->allows('moderate', $listing))->toBe($allowed)
        ->and(Gate::forUser($listing->user)->allows('moderate', $listing))->toBeFalse()
        ->and(Gate::forUser(null)->allows('moderate', $listing))->toBeFalse();
})->with(fn (): array => [
    [ListingStatus::Pending, true],
    [ListingStatus::Published, false],
    [ListingStatus::Draft, false],
]);
