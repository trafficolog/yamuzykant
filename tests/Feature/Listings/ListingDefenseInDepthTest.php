<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

// 2.1.7: защита владельца и смены статуса в глубину.

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('forceFill user_id у существующего объявления — исключение', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Draft)->create();
    $owner = $listing->user_id;
    $other = User::factory()->create();

    expect(fn () => $listing->forceFill(['user_id' => $other->id])->save())->toThrow(LogicException::class);
    expect((int) DB::table('listings')->where('id', $listing->id)->value('user_id'))->toBe($owner);
});

it('update user_id у существующего объявления — исключение', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Draft)->create();
    $owner = $listing->user_id;
    $other = User::factory()->create();

    expect(fn () => $listing->update(['user_id' => $other->id]))->toThrow(LogicException::class);
    expect((int) DB::table('listings')->where('id', $listing->id)->value('user_id'))->toBe($owner);
});

it('user_id задаётся при создании и не мешает обычной правке', function () {
    $user = User::factory()->create();
    $listing = Listing::factory()->inStatus(ListingStatus::Draft)->create(['user_id' => $user->id]);

    $listing->title = 'Fender ’62 Stratocaster';
    $listing->save();

    expect($listing->fresh()?->user_id)->toBe($user->id);
});

it('исключение внутри withStatusChange не оставляет разрешение включённым', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Draft)->create();

    try {
        $listing->withStatusChange(fn () => throw new RuntimeException('сбой'));
    } catch (RuntimeException) {
    }

    $listing->status = ListingStatus::Published;

    expect(fn () => $listing->save())->toThrow(LogicException::class);
});

it('разрешение смены статуса действует только на свой экземпляр', function () {
    $a = Listing::factory()->inStatus(ListingStatus::Draft)->create();
    $b = Listing::factory()->inStatus(ListingStatus::Draft)->create();

    $a->withStatusChange(function () use ($b): void {
        $b->status = ListingStatus::Published;

        expect(fn () => $b->save())->toThrow(LogicException::class);
    });
});

it('исключение внутри перехода машины не оставляет разрешение смены статуса включённым', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Draft)->create();
    $other = Listing::factory()->inStatus(ListingStatus::Draft)->create();

    Listing::saved(function (): void {
        throw new RuntimeException('сбой после записи');
    });

    try {
        expect(fn () => app(ListingStateMachine::class)->publish($listing))->toThrow(RuntimeException::class);
    } finally {
        Listing::clearBootedModels();
    }

    $other->status = ListingStatus::Published;
    expect(fn () => $other->save())->toThrow(LogicException::class);

    $listing->refresh();
    $listing->status = ListingStatus::Published;
    expect(fn () => $listing->save())->toThrow(LogicException::class);
});

// 2.1.8: владелец не меняется и в обход событий модели.

it('присваивание user_id и setAttribute(user_id) + save() — исключение', function (string $how) {
    $listing = Listing::factory()->inStatus(ListingStatus::Draft)->create();
    $owner = $listing->user_id;
    $other = User::factory()->create();

    if ($how === 'присваивание') {
        $listing->user_id = $other->id;
    } else {
        $listing->setAttribute('user_id', $other->id);
    }

    expect(fn () => $listing->save())->toThrow(LogicException::class);
    expect((int) DB::table('listings')->where('id', $listing->id)->value('user_id'))->toBe($owner);
})->with(['присваивание', 'setAttribute']);

it('saveQuietly() после присваивания user_id — ошибка БД, владелец прежний', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Draft)->create();
    $owner = $listing->user_id;
    $other = User::factory()->create();

    $listing->user_id = $other->id;

    // Ошибка в PostgreSQL обрывает транзакцию теста; savepoint откатывает только неудачную запись.
    expect(fn () => DB::transaction(fn () => $listing->saveQuietly()))->toThrow(QueryException::class);
    expect((int) DB::table('listings')->where('id', $listing->id)->value('user_id'))->toBe($owner);
});

it('запрос-построитель и DB::table со сменой user_id — ошибка БД', function (Closure $write) {
    $listing = Listing::factory()->inStatus(ListingStatus::Draft)->create();
    $owner = $listing->user_id;
    $other = User::factory()->create();

    expect(fn () => DB::transaction(fn () => $write($listing->id, $other->id)))->toThrow(QueryException::class);
    expect((int) DB::table('listings')->where('id', $listing->id)->value('user_id'))->toBe($owner);
})->with([
    'Listing::query()->update' => [fn (string $id, int $user) => Listing::query()->whereKey($id)->update(['user_id' => $user])],
    'DB::table()->update' => [fn (string $id, int $user) => DB::table('listings')->where('id', $id)->update(['user_id' => $user])],
]);

it('запись user_id тем же значением и правка других колонок в обход модели разрешены', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Draft)->create();

    DB::table('listings')->where('id', $listing->id)->update(['user_id' => $listing->user_id, 'title' => 'Gibson']);

    expect(DB::table('listings')->where('id', $listing->id)->value('title'))->toBe('Gibson');
});

it('fill(user_id) при незагруженной колонке и запрете ленивых атрибутов — LogicException', function () {
    $listing = Listing::factory()->inStatus(ListingStatus::Draft)->create();
    $partial = Listing::query()->select(['id', 'title'])->findOrFail($listing->id);

    Model::preventAccessingMissingAttributes();
    try {
        expect(fn () => $partial->fill(['user_id' => User::factory()->create()->id]))->toThrow(LogicException::class);
    } finally {
        Model::preventAccessingMissingAttributes(false);
    }
});
