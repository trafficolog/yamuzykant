<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Enums\InstrumentModelStatus;
use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\City;
use App\Domain\Catalog\Models\InstrumentModel;
use App\Domain\Listings\Enums\Condition;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;

// UC-L1 п. 1–6 (задача 2.1.3): страница «Продать инструмент» и серверная проверка формы (StoreListingRequest).
// Публикация, автосохранение и экран «Опубликовано» — 2.1.4: здесь запрос только записывает содержимое в черновик.

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

/** Объявление из БД: после записи формы. */
function sellReload(Listing $listing): Listing
{
    return Listing::query()->findOrFail($listing->id);
}

/** Вид инструмента (корень дерева категорий). */
function sellKind(string $name = 'Гитары'): Category
{
    return Category::factory()->create(['name' => $name, 'parent_id' => null, 'is_visible' => true]);
}

/** Пустой черновик продавца с фото: готовые, первое — серийный номер. */
function sellDraft(User $user, int $photos = 3, bool $serial = true): Listing
{
    $listing = Listing::factory()->for($user)->create([
        'category_id' => null, 'model_id' => null, 'title' => null, 'year' => null, 'serial_enc' => null,
        'condition' => null, 'description' => null, 'price' => null, 'city_id' => null,
        'negotiable' => false, 'meet' => true, 'ship' => false,
    ]);
    for ($i = 0; $i < $photos; $i++) {
        $photo = ListingPhoto::query()->create([
            'listing_id' => $listing->id,
            'path' => "photos/{$listing->id}/{$i}",
            'position' => $i,
            'is_serial' => $serial && $i === 0,
        ]);
        $photo->forceFill(['processed_at' => now()])->save();
    }

    return $listing;
}

/**
 * Полный запрос формы: пример из прототипа — Fender American Vintage ’57 Stratocaster за 184 500 ₽.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function sellPayload(Listing $listing, Category $kind, array $overrides = []): array
{
    return array_merge([
        'listing_id' => $listing->id,
        'category_id' => $kind->id,
        'title' => 'Fender American Vintage ’57 Stratocaster',
        'model_id' => null,
        'year' => 2009,
        'serial' => 'V091187',
        'condition' => 'excellent',
        'description' => 'Родной кейс, оригинальные звукосниматели.',
        'price_mode' => 'amount',
        'price' => 184_500,
        'negotiable' => true,
        'meet' => true,
        'ship' => true,
    ], $overrides);
}

/**
 * Продавец, вид инструмента и его черновик с 3 фото; город по умолчанию в справочнике.
 *
 * @return array{0: User, 1: Category, 2: Listing}
 */
function sellCase(): array
{
    $owner = User::factory()->create();
    City::factory()->create(['slug' => config('city.default_slug'), 'name' => 'Москва']);

    return [$owner, sellKind(), sellDraft($owner)];
}

describe('страница /sell', function () {
    it('гостя отправляет на главную: вход — окно, отдельной страницы нет', function () {
        $this->get('/sell')->assertRedirect('/');
    });

    it('показывает форму и создаёт черновик; повторный заход — тот же черновик', function () {
        $user = User::factory()->create();

        $this->actingAs($user)->get('/sell')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Sell/Create')
                ->where('listingId', Listing::query()->sole()->id)
                ->has('photos', 0)
                ->where('saved', false));

        $this->get('/sell')->assertOk();

        $listing = Listing::query()->sole();
        expect($listing->user_id)->toBe($user->id)->and($listing->status)->toBe(ListingStatus::Draft);
    });

    it('фото черновика приходят с флагом серийного номера; чужой черновик не используется', function () {
        $user = User::factory()->create();
        $draft = sellDraft($user);
        sellDraft(User::factory()->create());

        $this->actingAs($user)->get('/sell')
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('listingId', $draft->id)
                ->has('photos', 3)
                ->where('photos.0.is_serial', true));
    });

    it('опубликованное объявление не подменяет черновик', function () {
        $user = User::factory()->create();
        $published = Listing::factory()->for($user)->inStatus(ListingStatus::Published)->create();

        $this->actingAs($user)->get('/sell')
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('listingId', fn (string $id) => $id !== $published->id));
    });

    it('полный серийный номер на фронт не уходит', function () {
        $user = User::factory()->create();
        Listing::factory()->for($user)->create(['serial_enc' => 'V091187']);

        $response = $this->actingAs($user)->get('/sell')->assertOk();

        expect($response->getContent())->not->toContain('V091187');
    });
});

describe('StoreListingRequest', function () {
    it('полный запрос записывает содержимое в черновик и не меняет статус', function () {
        [$owner, $kind, $draft] = sellCase();
        $this->actingAs($owner)
            ->post('/sell', sellPayload($draft, $kind))
            ->assertSessionHasNoErrors()
            ->assertRedirect('/sell');

        $listing = sellReload($draft);
        expect($listing->status)->toBe(ListingStatus::Draft)
            ->and($listing->published_at)->toBeNull()
            ->and($listing->title)->toBe('Fender American Vintage ’57 Stratocaster')
            ->and($listing->category_id)->toBe($kind->id)
            ->and($listing->year)->toBe(2009)
            ->and($listing->serial_enc)->toBe('V091187')
            ->and($listing->condition)->toBe(Condition::Excellent)
            ->and($listing->price)->toBe(184_500)
            ->and($listing->negotiable)->toBeTrue()
            ->and($listing->meet)->toBeTrue()
            ->and($listing->ship)->toBeTrue()
            ->and($listing->city?->name)->toBe('Москва');
    });

    it('после записи страница один раз сообщает, что данные сохранены', function () {
        [$owner, $kind, $draft] = sellCase();
        $this->actingAs($owner)->post('/sell', sellPayload($draft, $kind));

        $this->get('/sell')->assertInertia(fn (AssertableInertia $page) => $page->where('saved', true));
        $this->get('/sell')->assertInertia(fn (AssertableInertia $page) => $page->where('saved', false));
    });

    it('серийный номер хранится зашифрованным', function () {
        [$owner, $kind, $draft] = sellCase();
        $this->actingAs($owner)->post('/sell', sellPayload($draft, $kind));

        $raw = (string) DB::table('listings')->where('id', $draft->id)->value('serial_enc');
        expect($raw)->not->toContain('V091187')->and($raw)->not->toBe('');
    });

    it('год и серийный номер необязательны', function () {
        [$owner, $kind, $draft] = sellCase();
        $this->actingAs($owner)
            ->post('/sell', sellPayload($draft, $kind, ['year' => null, 'serial' => null]))
            ->assertSessionHasNoErrors();

        expect(sellReload($draft)->year)->toBeNull();
    });

    it('модель из справочника привязывается по model_id', function () {
        [$owner, $kind, $draft] = sellCase();
        $model = InstrumentModel::factory()->create(['brand' => 'Fender', 'name' => 'American Vintage ’57 Stratocaster', 'category_id' => $kind->id]);

        $this->actingAs($owner)
            ->post('/sell', sellPayload($draft, $kind, ['model_id' => $model->id]))
            ->assertSessionHasNoErrors();

        expect(sellReload($draft)->model_id)->toBe($model->id);
    });

    it('модель без выбора из подсказки уходит в «Предложено продавцами» (UC-L1 2a)', function () {
        [$owner, $kind, $draft] = sellCase();
        $this->actingAs($owner)
            ->post('/sell', sellPayload($draft, $kind, ['title' => 'Harley Benton ST-62']))
            ->assertSessionHasNoErrors();

        $suggested = InstrumentModel::query()->where('brand', 'Harley')->sole();
        expect($suggested->status)->toBe(InstrumentModelStatus::Suggested)
            ->and($suggested->name)->toBe('Benton ST-62')
            ->and(sellReload($draft)->model_id)->toBe($suggested->id);
    });

    it('повторная отправка перезаписывает черновик, а не создаёт второй', function () {
        [$owner, $kind, $draft] = sellCase();
        $this->actingAs($owner)->post('/sell', sellPayload($draft, $kind));
        $this->actingAs($owner)->post('/sell', sellPayload($draft, $kind, ['price' => 170_000]));

        expect(Listing::query()->where('user_id', $owner->id)->count())->toBe(1)
            ->and(sellReload($draft)->price)->toBe(170_000);
    });

    it('гость — на главную, ничего не записано', function () {
        [$owner, $kind, $draft] = sellCase();
        $this->post('/sell', sellPayload($draft, $kind))->assertRedirect('/');

        expect(sellReload($draft)->title)->toBeNull();
    });

    it('каждое правило: запрос в обход клиента отклоняется и ничего не записывает', function (string $field, mixed $value) {
        [$owner, $kind, $draft] = sellCase();
        $this->actingAs($owner)
            ->from('/sell')
            ->post('/sell', sellPayload($draft, $kind, [$field => $value]))
            ->assertRedirect('/sell')
            ->assertSessionHasErrors($field);

        expect(sellReload($draft)->title)->toBeNull()->and(sellReload($draft)->price)->toBeNull();
    })->with([
        'вид не передан' => ['category_id', null],
        'вида нет' => ['category_id', 999_999],
        'название не передано' => ['title', null],
        'название пустое' => ['title', '   '],
        'только бренд, без модели' => ['title', 'Fender'],
        'название длиннее 120 символов' => ['title', 'Fender '.str_repeat('a', 120)],
        'модели нет' => ['model_id', 999_999],
        'год не число' => ['year', 'две тысячи'],
        'год в будущем' => ['year', 3000],
        'год до 1800' => ['year', 1799],
        'серийный номер длиннее 64 символов' => ['serial', str_repeat('A', 65)],
        'состояние не передано' => ['condition', null],
        'состояния нет в шкале' => ['condition', 'superb'],
        'описание длиннее 5000 символов' => ['description', str_repeat('а', 5001)],
        'цена не передана' => ['price', null],
        'цена — буквы' => ['price', 'abc'],
        'цена с пробелом' => ['price', '184 500'],
        'цена дробная' => ['price', 184_500.5],
        'цена ноль' => ['price', 0],
        'цена отрицательная' => ['price', -1],
        'цена больше предела' => ['price', 100_000_000],
        'способ цены не передан' => ['price_mode', null],
        'способа цены нет' => ['price_mode', 'barter'],
        'торг не булево' => ['negotiable', 'возможно'],
        'листинг не передан' => ['listing_id', null],
        'листинг не uuid' => ['listing_id', 'не-uuid'],
    ]);

    it('BR-11: «Договорная» — суммы нет, price = null, «Готов к торгу» принудительно выключен', function () {
        [$owner, $kind, $draft] = sellCase();
        $this->actingAs($owner)
            ->post('/sell', sellPayload($draft, $kind, ['price_mode' => 'negotiable', 'price' => null, 'negotiable' => true]))
            ->assertSessionHasNoErrors();

        $listing = sellReload($draft);
        expect($listing->price)->toBeNull()->and($listing->negotiable)->toBeFalse();
    });

    it('BR-11: «Бесплатно» — price = 0, «Готов к торгу» принудительно выключен', function () {
        [$owner, $kind, $draft] = sellCase();
        $this->actingAs($owner)
            ->post('/sell', sellPayload($draft, $kind, ['price_mode' => 'free', 'price' => null, 'negotiable' => true]))
            ->assertSessionHasNoErrors();

        $listing = sellReload($draft);
        expect($listing->price)->toBe(0)->and($listing->negotiable)->toBeFalse();
    });

    it('BR-11: с суммой «Готов к торгу» сохраняется как отправлен', function (bool $negotiable) {
        [$owner, $kind, $draft] = sellCase();
        $this->actingAs($owner)
            ->post('/sell', sellPayload($draft, $kind, ['negotiable' => $negotiable]))
            ->assertSessionHasNoErrors();

        expect(sellReload($draft)->negotiable)->toBe($negotiable);
    })->with(['с торгом' => [true], 'без торга' => [false]]);

    it('BR-11: при «Договорная» и «Бесплатно» сумма в запросе отклоняется', function (string $mode) {
        [$owner, $kind, $draft] = sellCase();
        $this->actingAs($owner)->from('/sell')
            ->post('/sell', sellPayload($draft, $kind, ['price_mode' => $mode, 'price' => 5000]))
            ->assertSessionHasErrors('price');

        expect(sellReload($draft)->price)->toBeNull();
    })->with(['договорная' => ['negotiable'], 'бесплатно' => ['free']]);

    it('BR-11: при «Договорная» сумма 0 тоже отклоняется (ноль задаёт только «Бесплатно»)', function () {
        [$owner, $kind, $draft] = sellCase();
        $this->actingAs($owner)->from('/sell')
            ->post('/sell', sellPayload($draft, $kind, ['price_mode' => 'negotiable', 'price' => 0]))
            ->assertSessionHasErrors('price');
    });

    it('без способа передачи отправка отклоняется', function () {
        [$owner, $kind, $draft] = sellCase();
        $this->actingAs($owner)->from('/sell')
            ->post('/sell', sellPayload($draft, $kind, ['meet' => false, 'ship' => false]))
            ->assertSessionHasErrors('meet');
    });

    it('достаточно одного способа передачи', function (bool $meet, bool $ship) {
        [$owner, $kind, $draft] = sellCase();
        $this->actingAs($owner)
            ->post('/sell', sellPayload($draft, $kind, ['meet' => $meet, 'ship' => $ship]))
            ->assertSessionHasNoErrors();
    })->with([[true, false], [false, true]]);

    it('скрытый вид и подкатегория не принимаются как вид', function (bool $hidden) {
        [$owner, $kind, $draft] = sellCase();
        $parent = sellKind('Аксессуары и запчасти');
        $category = $hidden
            ? Category::factory()->create(['parent_id' => null, 'is_visible' => false])
            : Category::factory()->create(['parent_id' => $parent->id, 'is_visible' => true]);

        $this->actingAs($owner)->from('/sell')
            ->post('/sell', sellPayload($draft, $kind, ['category_id' => $category->id]))
            ->assertSessionHasErrors('category_id');
    })->with(['скрытый вид' => [true], 'не вид, а подкатегория' => [false]]);

    it('скрытая и предложенная модели по model_id не принимаются', function (string $state) {
        [$owner, $kind, $draft] = sellCase();
        $model = InstrumentModel::factory()->{$state}()->create(['category_id' => $kind->id]);

        $this->actingAs($owner)->from('/sell')
            ->post('/sell', sellPayload($draft, $kind, ['model_id' => $model->id]))
            ->assertSessionHasErrors('model_id');
    })->with(['скрытая' => ['hiddenStatus'], 'предложенная' => ['suggested']]);

    it('2 фото: отказ с текстом «ещё 1 фото»', function () {
        [$owner, $kind, $draft] = sellCase();
        $listing = sellDraft($owner, photos: 2);

        $this->actingAs($owner)->from('/sell')
            ->post('/sell', sellPayload($listing, $kind))
            ->assertSessionHasErrors(['photos' => 'ещё 1 фото']);
    });

    it('нет фото серийного номера: отказ', function () {
        [$owner, $kind, $draft] = sellCase();
        $listing = sellDraft($owner, photos: 3, serial: false);

        $this->actingAs($owner)->from('/sell')
            ->post('/sell', sellPayload($listing, $kind))
            ->assertSessionHasErrors(['photos' => 'фото серийного номера']);
    });

    it('больше 12 фото: отказ', function () {
        [$owner, $kind, $draft] = sellCase();
        $listing = sellDraft($owner, photos: 13);

        $this->actingAs($owner)->from('/sell')
            ->post('/sell', sellPayload($listing, $kind))
            ->assertSessionHasErrors('photos');
    });

    it('чужой черновик нельзя записать', function () {
        [$owner, $kind, $draft] = sellCase();
        $foreign = sellDraft(User::factory()->create());

        $this->actingAs($owner)->from('/sell')
            ->post('/sell', sellPayload($foreign, $kind))
            ->assertSessionHasErrors('listing_id');

        expect(sellReload($foreign)->title)->toBeNull();
    });

    it('опубликованное объявление через форму не меняется', function () {
        [$owner, $kind, $draft] = sellCase();
        $published = Listing::factory()->for($owner)->inStatus(ListingStatus::Published)->create(['price' => 100_000]);

        $this->actingAs($owner)->from('/sell')
            ->post('/sell', sellPayload($published, $kind, ['price' => 1]))
            ->assertSessionHasErrors('listing_id');

        expect(sellReload($published)->price)->toBe(100_000);
    });

    it('в запросе нельзя подменить владельца, статус и город', function () {
        [$owner, $kind, $draft] = sellCase();
        $other = User::factory()->create();
        $city = City::factory()->create(['name' => 'Казань']);

        $this->actingAs($owner)->post('/sell', sellPayload($draft, $kind, [
            'user_id' => $other->id,
            'status' => 'published',
            'city_id' => $city->id,
        ]))->assertSessionHasNoErrors();

        $listing = sellReload($draft);
        expect($listing->user_id)->toBe($owner->id)
            ->and($listing->status)->toBe(ListingStatus::Draft)
            ->and($listing->city?->name)->toBe('Москва');
    });
});
