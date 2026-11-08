<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\InstrumentModel;
use App\Domain\Listings\Actions\FindOrCreateDraft;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;

// Ревью PR #126 (2.1.3), круг 1: общий суточный лимит предложений моделей, привязка model_id к виду и названию,
// черновик без гонки, серийный номер не попадает в flash-сессию.

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

describe('суточный лимит предложений моделей (1.2.2) действует и на POST /sell', function () {
    it('после исчерпания лимита новая модель через /sell отклоняется ошибкой у названия, черновик не публикуется', function () {
        config(['catalog.suggestions_per_day' => 2]);
        [$owner, $kind, $draft] = sellCase();

        // Каждая публикация освобождает слот черновика: следующая попытка идёт с новым черновиком.
        foreach (['Harley Benton ST-62', 'Harley Benton ST-63'] as $title) {
            $this->actingAs($owner)->post('/sell', sellPayload($draft, $kind, ['title' => $title]))->assertSessionHasNoErrors();
            $draft = sellDraft($owner);
        }

        $this->actingAs($owner)->from('/sell')
            ->post('/sell', sellPayload($draft, $kind, ['title' => 'Harley Benton ST-64', 'price' => 99_000]))
            ->assertRedirect('/sell')
            ->assertSessionHasErrors(['title' => 'Сегодня уже отправлено много предложений. Попробуйте завтра.']);

        expect(InstrumentModel::query()->where('name', 'Benton ST-64')->exists())->toBeFalse()
            ->and(sellReload($draft)->status)->toBe(ListingStatus::Draft)
            ->and(sellReload($draft)->price)->toBeNull();
    });

    it('счётчик общий с POST /api/models/suggestions', function () {
        config(['catalog.suggestions_per_day' => 1]);
        [$owner, $kind, $draft] = sellCase();

        $this->actingAs($owner)
            ->postJson('/api/models/suggestions', ['text' => 'Ibanez RG9999 Custom', 'category_id' => $kind->id])
            ->assertCreated();

        $this->actingAs($owner)->from('/sell')
            ->post('/sell', sellPayload($draft, $kind, ['title' => 'Harley Benton ST-62']))
            ->assertSessionHasErrors('title');
    });

    it('и в обратную сторону: предложение через /sell расходует лимит API', function () {
        config(['catalog.suggestions_per_day' => 1]);
        [$owner, $kind, $draft] = sellCase();

        $this->actingAs($owner)->post('/sell', sellPayload($draft, $kind, ['title' => 'Harley Benton ST-62']))
            ->assertSessionHasNoErrors();

        $this->actingAs($owner)
            ->postJson('/api/models/suggestions', ['text' => 'Ibanez RG9999 Custom', 'category_id' => $kind->id])
            ->assertStatus(429);
    });

    it('повторная отправка формы с той же моделью не расходует лимит', function () {
        config(['catalog.suggestions_per_day' => 1]);
        [$owner, $kind, $draft] = sellCase();

        foreach ([184_500, 170_000, 165_000] as $price) {
            $this->actingAs($owner)
                ->post('/sell', sellPayload($draft, $kind, ['title' => 'Harley Benton ST-62', 'price' => $price]))
                ->assertSessionHasNoErrors();
            $last = $draft;
            $draft = sellDraft($owner);
        }

        expect(sellReload($last)->price)->toBe(165_000);
    });

    it('модель из справочника по model_id лимит не расходует', function () {
        config(['catalog.suggestions_per_day' => 1]);
        [$owner, $kind, $draft] = sellCase();
        $model = InstrumentModel::factory()->create(['brand' => 'Fender', 'name' => 'Player Stratocaster', 'category_id' => $kind->id]);

        foreach ([1, 2] as $_) {
            $this->actingAs($owner)
                ->post('/sell', sellPayload($draft, $kind, ['title' => 'Fender Player Stratocaster', 'model_id' => $model->id]))
                ->assertSessionHasNoErrors();
            $draft = sellDraft($owner);
        }

        expect(RateLimiter::attempts('model-suggest:'.$owner->id))->toBe(0);
    });
});

describe('model_id соответствует виду и названию', function () {
    it('модель другого вида отклоняется', function () {
        [$owner, $kind, $draft] = sellCase();
        $other = sellKind('Ударные');
        $model = InstrumentModel::factory()->create(['brand' => 'Fender', 'name' => 'Player', 'category_id' => $other->id]);

        $this->actingAs($owner)->from('/sell')
            ->post('/sell', sellPayload($draft, $kind, ['title' => 'Fender Player', 'model_id' => $model->id]))
            ->assertSessionHasErrors('model_id');

        expect(sellReload($draft)->model_id)->toBeNull();
    });

    it('модель из пункта дерева выбранного вида принимается', function () {
        [$owner, $kind, $draft] = sellCase();
        $group = Category::factory()->create(['parent_id' => $kind->id, 'is_visible' => true]);
        $item = Category::factory()->create(['parent_id' => $group->id, 'is_visible' => true]);
        $model = InstrumentModel::factory()->create(['brand' => 'Fender', 'name' => 'Player', 'category_id' => $item->id]);

        $this->actingAs($owner)
            ->post('/sell', sellPayload($draft, $kind, ['title' => 'Fender Player', 'model_id' => $model->id]))
            ->assertSessionHasNoErrors();

        expect(sellReload($draft)->model_id)->toBe($model->id);
    });

    it('название не совпадает с выбранной моделью: отказ у названия', function () {
        [$owner, $kind, $draft] = sellCase();
        $model = InstrumentModel::factory()->create(['brand' => 'Fender', 'name' => 'Player', 'category_id' => $kind->id]);

        $this->actingAs($owner)->from('/sell')
            ->post('/sell', sellPayload($draft, $kind, ['title' => 'Gibson Les Paul', 'model_id' => $model->id]))
            ->assertSessionHasErrors('title');
    });

    it('регистр и лишние пробелы в названии не мешают', function () {
        [$owner, $kind, $draft] = sellCase();
        $model = InstrumentModel::factory()->create(['brand' => 'Fender', 'name' => 'Player', 'category_id' => $kind->id]);

        $this->actingAs($owner)
            ->post('/sell', sellPayload($draft, $kind, ['title' => 'fender   PLAYER', 'model_id' => $model->id]))
            ->assertSessionHasNoErrors();
    });
});

describe('serial не попадает во flash-сессию', function () {
    it('при ошибке валидации серийный номер не возвращается в old input, остальное возвращается', function () {
        [$owner, $kind, $draft] = sellCase();

        $this->actingAs($owner)->from('/sell')
            ->post('/sell', sellPayload($draft, $kind, ['serial' => 'V091187', 'price' => -5]))
            ->assertSessionHasErrors('price');

        expect(session()->hasOldInput('serial'))->toBeFalse()
            ->and(session()->hasOldInput('title'))->toBeTrue();
    });
});

describe('FindOrCreateDraft без гонки', function () {
    it('повторные вызовы возвращают один и тот же черновик', function () {
        $user = User::factory()->create();

        $first = app(FindOrCreateDraft::class)($user);
        $second = app(FindOrCreateDraft::class)($user);

        expect($second->id)->toBe($first->id)
            ->and(Listing::query()->where('user_id', $user->id)->where('status', ListingStatus::Draft->value)->count())->toBe(1);
    });

    it('под блокировкой строки пользователя: параллельный вызов ждёт, а не создаёт второй черновик', function () {
        if (DB::getDriverName() !== 'pgsql') {
            $this->markTestSkipped('FOR UPDATE есть только в PostgreSQL (в CI — PostgreSQL).');
        }

        $user = User::factory()->create();
        $queries = [];
        DB::listen(function ($query) use (&$queries): void {
            $queries[] = strtolower($query->sql);
        });

        app(FindOrCreateDraft::class)($user);

        $locked = array_filter($queries, fn (string $sql): bool => str_contains($sql, 'from "users"') && str_contains($sql, 'for update'));
        expect($locked)->not->toBeEmpty();
    });

    it('чужие и неЧерновые объявления не мешают: своё создаётся один раз', function () {
        $user = User::factory()->create();
        Listing::factory()->for($user)->inStatus(ListingStatus::Published)->create();
        Listing::factory()->create();

        $draft = app(FindOrCreateDraft::class)($user);
        app(FindOrCreateDraft::class)($user);

        expect($draft->status)->toBe(ListingStatus::Draft)
            ->and(Listing::query()->where('user_id', $user->id)->where('status', ListingStatus::Draft->value)->count())->toBe(1);
    });
});
