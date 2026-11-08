<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Models\InstrumentModel;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Domain\Listings\Models\SaleRecord;
use App\Domain\Moderation\AutoChecks\AutoCheck;
use App\Domain\Moderation\AutoChecks\ListingAutoChecks;
use App\Domain\Moderation\Enums\RiskLevel;

// UC-O1, BR-04 (задача 5.1.1): сервис автопроверок. validate() — блокирующие ошибки по полям (контакты в тексте),
// assess() — сигналы риска (стоп-слова, дубль фото, цена ниже рынка; контакты — тоже).

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

function autoChecks(): ListingAutoChecks
{
    return app(ListingAutoChecks::class);
}

/** Объявление в памяти, без записи в БД: так проверяется содержимое формы до сохранения. */
function textListing(?string $title, ?string $description): Listing
{
    return new Listing(['title' => $title, 'description' => $description]);
}

/** Фото объявления с заданным pHash. */
function photoWithHash(Listing $listing, string $phash, int $position = 0): ListingPhoto
{
    $photo = ListingPhoto::query()->create([
        'listing_id' => $listing->id,
        'path' => "photos/{$listing->id}/{$position}",
        'position' => $position,
        'is_serial' => false,
    ]);
    $photo->forceFill(['processed_at' => now(), 'phash' => $phash])->save();

    return $photo;
}

/** Продажи модели: по одной записи на объявление. */
function salesOfModel(InstrumentModel $model, int $count, int $finalPrice): void
{
    for ($i = 0; $i < $count; $i++) {
        $sold = Listing::factory()->inStatus(ListingStatus::Withdrawn)->create(['model_id' => $model->id]);
        SaleRecord::query()->create([
            'listing_id' => $sold->id,
            'reason' => WithdrawReason::SoldHere,
            'final_price' => $finalPrice,
            'sold_at' => now()->subDays(10),
        ]);
    }
}

describe('validate: блокирующие ошибки', function () {
    it('чистое объявление не даёт ошибок', function () {
        $report = autoChecks()->validate(textListing('Fender ’57 Stratocaster', 'Родной кейс, оригинальные звукосниматели.'));

        expect($report->errors())->toBe([])->and($report->blocked())->toBeFalse();
    });

    it('телефон в описании блокирует и привязан к полю «Описание» с подсказкой из UC-L1', function () {
        $report = autoChecks()->validate(textListing('Fender ’57 Stratocaster', 'Звоните 8 916 123-45-67'));

        expect($report->blocked())->toBeTrue()
            ->and($report->errors())->toBe([
                'description' => 'Уберите телефон из описания — покупатели напишут вам в сообщениях.',
            ]);
    });

    it('контакт в названии блокирует и привязан к полю «Название»', function () {
        $report = autoChecks()->validate(textListing('Fender Stratocaster tg @ivan_guitar', null));

        expect(array_keys($report->errors()))->toBe(['title'])
            ->and($report->errors()['title'])->toContain('из названия');
    });

    it('e-mail, ссылка и мессенджер блокируют, подсказка называет вид найденного без самого фрагмента', function (string $text, string $hint) {
        $errors = autoChecks()->validate(textListing('Fender ’57 Stratocaster', $text))->errors();

        expect($errors)->toBe(['description' => "Уберите {$hint} из описания — покупатели напишут вам в сообщениях."]);
    })->with([
        'e-mail' => ['пишите ivan@mail.ru', 'почту'],
        'ссылка' => ['смотрите https://example.com/lot', 'ссылку'],
        'мессенджер' => ['напишите в WhatsApp', 'мессенджер'],
        'ник' => ['мой ник @ivan_guitar', 'ник'],
    ]);

    it('стоп-слова и ценовые признаки не блокируют отправку', function () {
        $listing = textListing('Fender ’57 Stratocaster', 'Нужна предоплата на карту');

        expect(autoChecks()->validate($listing)->blocked())->toBeFalse();
    });

    it('год, модель и цена в тексте не считаются телефоном', function () {
        $report = autoChecks()->validate(textListing('Yamaha DX7 1983', 'Shure SM58 в комплекте, цена 184 500 ₽, год 1983.'));

        expect($report->blocked())->toBeFalse();
    });
});

describe('assess: признаки риска', function () {
    it('чистое объявление: сигналов нет, риск normal', function () {
        $listing = Listing::factory()->inStatus(ListingStatus::Published)->create();
        photoWithHash($listing, '0123456789abcdef');

        $report = autoChecks()->assess($listing);

        expect($report->signals())->toBe([])->and($report->risk())->toBe(RiskLevel::Normal);
    });

    it('стоп-слово из конфига: сигнал с пояснением, риск high', function () {
        config(['moderation.stop_words' => ['предоплата']]);
        $listing = Listing::factory()->inStatus(ListingStatus::Published)->create([
            'description' => 'Отправлю после ПРЕДОПЛАТЫ... нет, нужна предоплата.',
        ]);

        $report = autoChecks()->assess($listing);

        expect($report->codes())->toBe(['stop_words'])
            ->and($report->risk())->toBe(RiskLevel::High)
            ->and($report->signals()[0]->message)->toContain('предоплата')
            ->and($report->signals()[0]->field)->toBe('description');
    });

    it('стоп-слово ищется целым словом: часть чужого слова не срабатывает', function () {
        config(['moderation.stop_words' => ['аванс']]);
        $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['description' => 'Авансцена, барабаны для авансцены.']);

        expect(autoChecks()->assess($listing)->codes())->toBe([]);
    });

    it('стоп-слово находится при подмене букв латиницей и в названии', function () {
        config(['moderation.stop_words' => ['предоплата']]);
        $listing = Listing::factory()->inStatus(ListingStatus::Published)->create([
            'title' => 'Fender Stratocaster',
            'description' => 'прeдoплaта на карту',
        ]);

        expect(autoChecks()->assess($listing)->codes())->toBe(['stop_words']);
    });

    it('пустой список стоп-слов в конфиге ничего не находит', function () {
        config(['moderation.stop_words' => []]);
        $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['description' => 'предоплата']);

        expect(autoChecks()->assess($listing)->codes())->toBe([]);
    });

    it('в пояснении и деталях контакт замаскирован, полный номер и почта не хранятся', function () {
        $listing = Listing::factory()->inStatus(ListingStatus::Published)->create([
            'description' => 'Звоните 8 916 123-45-67 или ivan.petrov@mail.ru',
        ]);

        $signal = autoChecks()->assess($listing)->signals()[0];

        $stored = (string) json_encode($signal->toArray(), JSON_UNESCAPED_UNICODE);

        expect($stored)->not->toContain('1234567')->not->toContain('ivan.petrov')
            ->and($signal->details['excerpt'])->toBe('i***@mail.ru');
    });

    it('контакты в тексте — сигнал риска и для уже сохранённого объявления', function () {
        $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['description' => 'Звоните 89161234567']);

        $report = autoChecks()->assess($listing);

        expect($report->codes())->toBe(['contacts'])->and($report->risk())->toBe(RiskLevel::High);
    });

    describe('дубль фото', function () {
        it('фото с расстоянием pHash не больше 6 от фото другого продавца — сигнал', function () {
            $other = Listing::factory()->inStatus(ListingStatus::Published)->create();
            photoWithHash($other, '0000000000000000');
            $listing = Listing::factory()->inStatus(ListingStatus::Published)->create();
            photoWithHash($listing, '000000000000003f'); // 6 бит

            $report = autoChecks()->assess($listing);

            expect($report->codes())->toBe(['duplicate_photo'])
                ->and($report->risk())->toBe(RiskLevel::High)
                ->and($report->signals()[0]->details['listing_id'])->toBe($other->id)
                ->and($report->signals()[0]->details['distance'])->toBe(6);
        });

        it('расстояние 7 — не дубль', function () {
            $other = Listing::factory()->inStatus(ListingStatus::Published)->create();
            photoWithHash($other, '0000000000000000');
            $listing = Listing::factory()->inStatus(ListingStatus::Published)->create();
            photoWithHash($listing, '000000000000007f'); // 7 бит

            expect(autoChecks()->assess($listing)->codes())->toBe([]);
        });

        it('порог берётся из конфига', function () {
            config(['moderation.duplicate_photo_max_distance' => 2]);
            $other = Listing::factory()->inStatus(ListingStatus::Published)->create();
            photoWithHash($other, '0000000000000000');
            $listing = Listing::factory()->inStatus(ListingStatus::Published)->create();
            photoWithHash($listing, '0000000000000007'); // 3 бита

            expect(autoChecks()->assess($listing)->codes())->toBe([]);
        });

        it('свои объявления и свои же фото не считаются дублем: повторная публикация того же инструмента — норма', function () {
            $owner = User::factory()->create();
            $old = Listing::factory()->for($owner)->inStatus(ListingStatus::Withdrawn)->create();
            photoWithHash($old, '0000000000000000');
            $listing = Listing::factory()->for($owner)->inStatus(ListingStatus::Published)->create();
            photoWithHash($listing, '0000000000000000', 0);
            photoWithHash($listing, '0000000000000000', 1);

            expect(autoChecks()->assess($listing)->codes())->toBe([]);
        });

        it('черновики других продавцов и фото без pHash не участвуют', function () {
            $draft = Listing::factory()->create();
            photoWithHash($draft, '0000000000000000');
            $nohash = Listing::factory()->inStatus(ListingStatus::Published)->create();
            ListingPhoto::query()->create(['listing_id' => $nohash->id, 'path' => 'p', 'position' => 0, 'is_serial' => false]);
            $listing = Listing::factory()->inStatus(ListingStatus::Published)->create();
            photoWithHash($listing, '0000000000000000');

            expect(autoChecks()->assess($listing)->codes())->toBe([]);
        });

        it('сигнал один на объявление, даже если совпали несколько фото', function () {
            $other = Listing::factory()->inStatus(ListingStatus::Published)->create();
            photoWithHash($other, '0000000000000000', 0);
            photoWithHash($other, '0000000000000001', 1);
            $listing = Listing::factory()->inStatus(ListingStatus::Published)->create();
            photoWithHash($listing, '0000000000000000', 0);
            photoWithHash($listing, '0000000000000003', 1);

            expect(autoChecks()->assess($listing)->codes())->toBe(['duplicate_photo']);
        });
    });

    describe('цена ниже рынка', function () {
        it('цена ниже 60 % медианы продаж модели при 5 продажах — сигнал', function () {
            $model = InstrumentModel::factory()->create();
            salesOfModel($model, 5, 100_000);
            $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['model_id' => $model->id, 'price' => 59_999]);

            $report = autoChecks()->assess($listing);

            expect($report->codes())->toBe(['low_price'])
                ->and($report->risk())->toBe(RiskLevel::High)
                ->and($report->signals()[0]->field)->toBe('price')
                ->and($report->signals()[0]->details)->toMatchArray(['median' => 100_000, 'sales' => 5]);
        });

        it('ровно 60 % медианы и выше — не сигнал', function () {
            $model = InstrumentModel::factory()->create();
            salesOfModel($model, 5, 100_000);
            $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['model_id' => $model->id, 'price' => 60_000]);

            expect(autoChecks()->assess($listing)->codes())->toBe([]);
        });

        it('меньше 5 продаж — медиана не считается', function () {
            $model = InstrumentModel::factory()->create();
            salesOfModel($model, 4, 100_000);
            $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['model_id' => $model->id, 'price' => 1_000]);

            expect(autoChecks()->assess($listing)->codes())->toBe([]);
        });

        it('медиана, а не среднее: одна экстремальная продажа её не сдвигает', function () {
            $model = InstrumentModel::factory()->create();
            salesOfModel($model, 4, 100_000);
            salesOfModel($model, 1, 9_000_000);
            $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['model_id' => $model->id, 'price' => 70_000]);

            expect(autoChecks()->assess($listing)->codes())->toBe([]);
        });

        it('продажи без итоговой цены и «не продал» не участвуют', function () {
            $model = InstrumentModel::factory()->create();
            salesOfModel($model, 4, 100_000);
            $noPrice = Listing::factory()->inStatus(ListingStatus::Withdrawn)->create(['model_id' => $model->id]);
            SaleRecord::query()->create(['listing_id' => $noPrice->id, 'reason' => WithdrawReason::SoldElsewhere, 'final_price' => null]);
            $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['model_id' => $model->id, 'price' => 1_000]);

            expect(autoChecks()->assess($listing)->codes())->toBe([]);
        });

        it('продажи другой модели не участвуют', function () {
            $model = InstrumentModel::factory()->create();
            salesOfModel(InstrumentModel::factory()->create(), 5, 100_000);
            $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['model_id' => $model->id, 'price' => 1_000]);

            expect(autoChecks()->assess($listing)->codes())->toBe([]);
        });

        it('цена «Договорная» (null) и «Бесплатно» (0) пропускаются (BR-11)', function (?int $price) {
            $model = InstrumentModel::factory()->create();
            salesOfModel($model, 5, 100_000);
            $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['model_id' => $model->id, 'price' => $price]);

            expect(autoChecks()->assess($listing)->codes())->toBe([]);
        })->with(['договорная' => [null], 'бесплатно' => [0]]);

        it('без модели проверка пропускается', function () {
            $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['model_id' => null, 'price' => 1_000]);

            expect(autoChecks()->assess($listing)->codes())->toBe([]);
        });

        it('процент и минимум продаж берутся из конфига', function () {
            $model = InstrumentModel::factory()->create();
            config(['moderation.price_median_percent' => 80, 'moderation.price_median_min_sales' => 3]);
            salesOfModel($model, 3, 100_000);
            $listing = Listing::factory()->inStatus(ListingStatus::Published)->create(['model_id' => $model->id, 'price' => 79_000]);

            expect(autoChecks()->assess($listing)->codes())->toBe(['low_price']);
        });
    });

    it('несколько признаков складываются в один отчёт', function () {
        config(['moderation.stop_words' => ['предоплата']]);
        $model = InstrumentModel::factory()->create();
        salesOfModel($model, 5, 100_000);
        $listing = Listing::factory()->inStatus(ListingStatus::Published)->create([
            'model_id' => $model->id, 'price' => 10_000, 'description' => 'нужна предоплата',
        ]);

        expect(autoChecks()->assess($listing)->codes())->toBe(['stop_words', 'low_price']);
    });
});

it('все проверки сервиса реализуют AutoCheck и различаются кодами', function () {
    $codes = array_map(fn (AutoCheck $check): string => $check->code(), autoChecks()->checks());

    expect($codes)->toBe(['contacts', 'stop_words', 'duplicate_photo', 'low_price']);
});
