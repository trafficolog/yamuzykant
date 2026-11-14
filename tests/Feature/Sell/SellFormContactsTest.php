<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\City;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;

// BR-04, UC-L1 (задача 5.1.1): контакты в названии и описании блокируют отправку формы «Продать»;
// ошибка приходит у поля, черновик не меняется.

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

/**
 * Продавец, вид инструмента и пустой черновик с 3 готовыми фото (первое — серийный номер).
 *
 * @return array{0: User, 1: Category, 2: Listing}
 */
function contactsCase(): array
{
    $owner = User::factory()->create();
    City::factory()->create(['slug' => config('city.default_slug'), 'name' => 'Москва']);
    $kind = Category::factory()->create(['name' => 'Гитары', 'parent_id' => null, 'is_visible' => true]);
    $draft = Listing::factory()->for($owner)->create([
        'category_id' => null, 'model_id' => null, 'title' => null, 'year' => null, 'serial_enc' => null,
        'condition' => null, 'description' => null, 'price' => null, 'city_id' => null,
    ]);
    for ($i = 0; $i < 3; $i++) {
        $photo = ListingPhoto::query()->create([
            'listing_id' => $draft->id, 'path' => "photos/{$draft->id}/{$i}", 'position' => $i, 'is_serial' => $i === 0,
        ]);
        $photo->forceFill(['processed_at' => now()])->save();
    }

    return [$owner, $kind, $draft];
}

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function contactsPayload(Listing $listing, Category $kind, array $overrides = []): array
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

const CONTACTS_HINT = 'Уберите телефон из описания — покупатели напишут вам в сообщениях.';

it('телефон в описании: ошибка у поля «Описание», черновик не изменён', function () {
    [$owner, $kind, $draft] = contactsCase();

    $this->actingAs($owner)
        ->post('/sell', contactsPayload($draft, $kind, ['description' => 'Отличная гитара, звоните +7 916 123-45-67']))
        ->assertSessionHasErrors(['description' => CONTACTS_HINT]);

    expect(Listing::query()->findOrFail($draft->id)->description)->toBeNull();
});

it('e-mail, ссылка и мессенджер в описании блокируют, подсказка называет вид', function (string $text, string $hint) {
    [$owner, $kind, $draft] = contactsCase();

    $this->actingAs($owner)
        ->post('/sell', contactsPayload($draft, $kind, ['description' => $text]))
        ->assertSessionHasErrors(['description' => "Уберите {$hint} из описания — покупатели напишут вам в сообщениях."]);
})->with([
    'e-mail' => ['Пишите ivan@mail.ru', 'почту'],
    'ссылка' => ['Больше фото: https://example.com/strat', 'ссылку'],
    'мессенджер' => ['Все вопросы в WhatsApp ivan_g77', 'мессенджер'],
    'цифры словами' => ['восемь девять один шесть один два три четыре пять шесть семь', 'телефон'],
]);

it('контакт в названии: ошибка у поля «Название»', function () {
    [$owner, $kind, $draft] = contactsCase();

    $this->actingAs($owner)
        ->post('/sell', contactsPayload($draft, $kind, ['title' => 'Fender Stratocaster @ivan_guitar']))
        ->assertSessionHasErrors(['title']);
});

it('год, модель и цена в описании форму не блокируют', function () {
    [$owner, $kind, $draft] = contactsCase();

    $this->actingAs($owner)
        ->post('/sell', contactsPayload($draft, $kind, ['description' => 'Yamaha DX7, 1983 год, Shure SM58 в комплекте, торг при осмотре.']))
        ->assertSessionHasNoErrors();

    expect(Listing::query()->findOrFail($draft->id)->description)->toContain('DX7');
});

it('ошибки контактов приходят вместе с другими ошибками формы', function () {
    [$owner, $kind, $draft] = contactsCase();

    $this->actingAs($owner)
        ->post('/sell', contactsPayload($draft, $kind, ['description' => 'пишите 89161234567', 'condition' => null]))
        ->assertSessionHasErrors(['description', 'condition']);
});
