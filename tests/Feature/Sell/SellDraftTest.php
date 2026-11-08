<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Models\InstrumentModel;
use App\Domain\Listings\Enums\Condition;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;

// UC-L1 7b (задача 2.1.4): автосохранение каждые 5 с и «Сохранить черновик» — PUT /sell/draft сохраняет любое
// подмножество полей формы без обязательности; страница /sell восстанавливает форму из черновика.
// Серийный номер на фронт целиком не уходит (AGENTS.md §4): страница отдаёт маску.

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

describe('PUT /sell/draft', function () {
    it('сохраняет частично заполненную форму, статус не меняется', function () {
        [$owner, $kind, $draft] = sellCase();

        $this->actingAs($owner)
            ->putJson('/sell/draft', ['listing_id' => $draft->id, 'category_id' => $kind->id, 'title' => 'Fender Strat'])
            ->assertOk()
            ->assertJsonStructure(['saved_at']);

        $listing = sellReload($draft);
        expect($listing->status)->toBe(ListingStatus::Draft)
            ->and($listing->title)->toBe('Fender Strat')
            ->and($listing->category_id)->toBe($kind->id)
            ->and($listing->condition)->toBeNull()
            ->and($listing->price)->toBeNull()
            ->and($listing->city?->name)->toBe('Москва');
    });

    it('сохраняет все поля формы вместе с режимом цены', function () {
        [$owner, $kind, $draft] = sellCase();

        $this->actingAs($owner)->putJson('/sell/draft', [
            'listing_id' => $draft->id, 'category_id' => $kind->id, 'title' => 'Fender Stratocaster',
            'year' => 2009, 'serial' => 'V091187', 'condition' => 'excellent', 'description' => 'Родной кейс.',
            'price_mode' => 'amount', 'price' => 184_500, 'negotiable' => true, 'meet' => true, 'ship' => false,
        ])->assertOk();

        $listing = sellReload($draft);
        expect($listing->year)->toBe(2009)
            ->and($listing->serial_enc)->toBe('V091187')
            ->and($listing->condition)->toBe(Condition::Excellent)
            ->and($listing->price)->toBe(184_500)
            ->and($listing->negotiable)->toBeTrue()
            ->and($listing->ship)->toBeFalse()
            ->and($listing->draft_price_mode)->toBe('amount');
    });

    it('режим цены: «Договорная» — price null, «Бесплатно» — 0, «Готов к торгу» только с суммой', function () {
        [$owner, , $draft] = sellCase();

        $this->actingAs($owner)->putJson('/sell/draft', ['listing_id' => $draft->id, 'price_mode' => 'free', 'negotiable' => true])->assertOk();
        expect(sellReload($draft)->price)->toBe(0)->and(sellReload($draft)->negotiable)->toBeFalse();

        $this->actingAs($owner)->putJson('/sell/draft', ['listing_id' => $draft->id, 'price_mode' => 'negotiable'])->assertOk();
        expect(sellReload($draft)->price)->toBeNull()->and(sellReload($draft)->draft_price_mode)->toBe('negotiable');
    });

    it('передаются только присланные поля: остальное не затирается', function () {
        [$owner, $kind, $draft] = sellCase();
        $this->actingAs($owner)->putJson('/sell/draft', ['listing_id' => $draft->id, 'title' => 'Fender Strat', 'year' => 2009, 'serial' => 'V091187']);
        $this->actingAs($owner)->putJson('/sell/draft', ['listing_id' => $draft->id, 'description' => 'Только описание']);

        $listing = sellReload($draft);
        expect($listing->title)->toBe('Fender Strat')->and($listing->year)->toBe(2009)
            ->and($listing->serial_enc)->toBe('V091187')->and($listing->description)->toBe('Только описание');
    });

    it('пустые строки и null очищают поле', function () {
        [$owner, , $draft] = sellCase();
        $this->actingAs($owner)->putJson('/sell/draft', ['listing_id' => $draft->id, 'title' => 'Fender Strat', 'serial' => 'V091187', 'year' => 2009]);
        $this->actingAs($owner)->putJson('/sell/draft', ['listing_id' => $draft->id, 'title' => '', 'serial' => null, 'year' => null])->assertOk();

        $listing = sellReload($draft);
        expect($listing->title)->toBeNull()->and($listing->serial_enc)->toBeNull()->and($listing->year)->toBeNull();
    });

    it('не предлагает модель в справочник и не тратит суточный лимит предложений', function () {
        [$owner, $kind, $draft] = sellCase();
        $before = InstrumentModel::query()->count();

        foreach (['Harley', 'Harley Benton', 'Harley Benton ST-62'] as $title) {
            $this->actingAs($owner)->putJson('/sell/draft', ['listing_id' => $draft->id, 'category_id' => $kind->id, 'title' => $title])->assertOk();
        }

        expect(InstrumentModel::query()->count())->toBe($before)->and(sellReload($draft)->model_id)->toBeNull();
    });

    it('модель из справочника сохраняется по model_id', function () {
        [$owner, $kind, $draft] = sellCase();
        $model = InstrumentModel::factory()->create(['brand' => 'Fender', 'name' => 'Stratocaster', 'category_id' => $kind->id]);

        $this->actingAs($owner)->putJson('/sell/draft', [
            'listing_id' => $draft->id, 'category_id' => $kind->id, 'title' => 'Fender Stratocaster', 'model_id' => $model->id,
        ])->assertOk();

        expect(sellReload($draft)->model_id)->toBe($model->id);
    });

    it('контакты в описании черновик не блокируют (блокируется только публикация)', function () {
        [$owner, , $draft] = sellCase();

        $this->actingAs($owner)->putJson('/sell/draft', ['listing_id' => $draft->id, 'description' => 'Звоните 89161234567'])->assertOk();

        expect(sellReload($draft)->description)->toBe('Звоните 89161234567');
    });

    it('пределы полей действуют и на черновик', function (string $field, mixed $value) {
        [$owner, , $draft] = sellCase();

        $this->actingAs($owner)->putJson('/sell/draft', ['listing_id' => $draft->id, $field => $value])
            ->assertUnprocessable()->assertJsonValidationErrors($field);
    })->with([
        'название' => ['title', str_repeat('a', 121)],
        'описание' => ['description', str_repeat('a', 5001)],
        'серийный номер' => ['serial', str_repeat('a', 65)],
        'год раньше 1800' => ['year', 1799],
        'сумма больше предела' => ['price', 100_000_000],
        'режим цены' => ['price_mode', 'cheap'],
        'состояние' => ['condition', 'broken'],
        'скрытый вид' => ['category_id', 999_999],
    ]);

    it('чужой, опубликованный и несуществующий черновик не записываются', function () {
        [$owner, , $draft] = sellCase();
        $foreign = sellDraft(User::factory()->create());
        $published = Listing::factory()->for($owner)->inStatus(ListingStatus::Published)->create(['title' => 'Fender Old']);

        foreach ([$foreign->id, $published->id, '00000000-0000-4000-8000-000000000000'] as $id) {
            $this->actingAs($owner)->putJson('/sell/draft', ['listing_id' => $id, 'title' => 'Hacked Title'])
                ->assertUnprocessable()->assertJsonValidationErrors('listing_id');
        }

        expect(sellReload($foreign)->title)->toBeNull()->and(sellReload($published)->title)->toBe('Fender Old');
    });

    it('гость получает 401, владельца и статус подменить нельзя', function () {
        [$owner, , $draft] = sellCase();
        $other = User::factory()->create();

        $this->putJson('/sell/draft', ['listing_id' => $draft->id, 'title' => 'Fender Strat'])->assertUnauthorized();

        $this->actingAs($owner)->putJson('/sell/draft', [
            'listing_id' => $draft->id, 'title' => 'Fender Strat', 'user_id' => $other->id, 'status' => 'published',
        ])->assertOk();
        $listing = sellReload($draft);
        expect($listing->user_id)->toBe($owner->id)->and($listing->status)->toBe(ListingStatus::Draft);
    });

    it('серийный номер хранится зашифрованным и не попадает в ответ', function () {
        [$owner, , $draft] = sellCase();

        $response = $this->actingAs($owner)->putJson('/sell/draft', ['listing_id' => $draft->id, 'serial' => 'V091187'])->assertOk();

        expect($response->getContent())->not->toContain('V091187')
            ->and((string) DB::table('listings')->where('id', $draft->id)->value('serial_enc'))->not->toContain('V091187');
    });
});

describe('восстановление формы после перезагрузки', function () {
    it('новый черновик: draft = null, форма с настройками по умолчанию', function () {
        $user = User::factory()->create();

        $this->actingAs($user)->get('/sell')
            ->assertInertia(fn (AssertableInertia $page) => $page->where('draft', null));
    });

    it('после автосохранения страница отдаёт черновик и фото', function () {
        [$owner, $kind, $draft] = sellCase();
        $this->actingAs($owner)->putJson('/sell/draft', [
            'listing_id' => $draft->id, 'category_id' => $kind->id, 'title' => 'Fender Stratocaster', 'year' => 2009,
            'serial' => 'V091187', 'condition' => 'excellent', 'description' => 'Родной кейс.',
            'price_mode' => 'amount', 'price' => 184_500, 'negotiable' => false, 'meet' => false, 'ship' => true,
        ])->assertOk();

        $this->get('/sell')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->where('listingId', $draft->id)
            ->has('photos', 3)
            ->where('draft.kind_id', $kind->id)
            ->where('draft.title', 'Fender Stratocaster')
            ->where('draft.year', 2009)
            ->where('draft.condition', 'excellent')
            ->where('draft.description', 'Родной кейс.')
            ->where('draft.price_mode', 'amount')
            ->where('draft.price', 184_500)
            ->where('draft.negotiable', false)
            ->where('draft.meet', false)
            ->where('draft.ship', true)
            ->where('draft.serial_masked', 'V09****')
            ->missing('draft.serial'));
    });

    it('«Договорная» и «Бесплатно» восстанавливаются как режим, а не как пустая сумма', function (string $mode) {
        [$owner, , $draft] = sellCase();
        $this->actingAs($owner)->putJson('/sell/draft', ['listing_id' => $draft->id, 'price_mode' => $mode])->assertOk();

        $this->get('/sell')->assertInertia(fn (AssertableInertia $page) => $page->where('draft.price_mode', $mode));
    })->with(['negotiable', 'free']);

    it('полный серийный номер на фронт не уходит и после автосохранения', function () {
        [$owner, , $draft] = sellCase();
        $this->actingAs($owner)->putJson('/sell/draft', ['listing_id' => $draft->id, 'serial' => 'V091187']);

        expect($this->get('/sell')->assertOk()->getContent())->not->toContain('V091187');
    });
});
