<?php

declare(strict_types=1);

use App\Domain\Listings\Enums\Condition;
use App\Domain\Search\FleaFilters;
use App\Domain\Search\FleaSort;
use App\Domain\Search\ListingSort;

// UC-S3: адрес выдачи Барахолки — единственный источник фильтров. Разбор query терпим к мусору
// и не бросает исключений: ссылку с поломанным параметром открывают, лишнее отбрасывается.

it('пустой query — умолчания: без фильтров, сортировка по умолчанию, первая страница', function () {
    $filters = FleaFilters::fromQuery([]);

    expect($filters->query)->toBe('')
        ->and($filters->conditions)->toBe([])
        ->and($filters->priceFrom)->toBeNull()
        ->and($filters->priceTo)->toBeNull()
        ->and($filters->negotiable)->toBeFalse()
        ->and($filters->ship)->toBeFalse()
        ->and($filters->sort)->toBeNull()
        ->and($filters->page)->toBe(1)
        ->and($filters->toQuery())->toBe([]);
});

it('разбирает все параметры адреса', function () {
    $filters = FleaFilters::fromQuery([
        'q' => '  стратокастер ',
        'condition' => ['excellent', 'very-good'],
        'price_from' => '50000',
        'price_to' => '200000',
        'negotiable' => '1',
        'ship' => '1',
        'sort' => 'cheap',
        'page' => '3',
    ]);

    expect($filters->query)->toBe('стратокастер')
        ->and($filters->conditions)->toBe([Condition::Excellent, Condition::VeryGood])
        ->and($filters->priceFrom)->toBe(50_000)
        ->and($filters->priceTo)->toBe(200_000)
        ->and($filters->negotiable)->toBeTrue()
        ->and($filters->ship)->toBeTrue()
        ->and($filters->sort)->toBe(FleaSort::PriceAsc)
        ->and($filters->page)->toBe(3);
});

it('toQuery отдаёт только заданное и в одном порядке — адрес стабилен', function () {
    $filters = FleaFilters::fromQuery([
        'page' => '2',
        'ship' => '1',
        'condition' => ['good', 'excellent'],
        'price_to' => '90000',
    ]);

    expect($filters->toQuery())->toBe([
        'condition' => ['excellent', 'good'],
        'price_to' => 90_000,
        'ship' => 1,
        'page' => 2,
    ]);
});

it('состояния можно передать списком через запятую', function () {
    expect(FleaFilters::fromQuery(['condition' => 'mint,good'])->conditions)
        ->toBe([Condition::Mint, Condition::Good]);
});

it('мусор отбрасывается без ошибок', function (array $query) {
    $filters = FleaFilters::fromQuery($query);

    expect($filters->toQuery())->toBe([]);
})->with([
    'неизвестное состояние' => [['condition' => ['broken', '']]],
    'состояние не строкой' => [['condition' => [['x']]]],
    'цена не числом' => [['price_from' => 'abc', 'price_to' => '1e9']],
    'отрицательная цена' => [['price_from' => '-5']],
    'цена-массив' => [['price_to' => ['1']]],
    'гигантская цена' => [['price_to' => '99999999999999999999']],
    'неизвестная сортировка' => [['sort' => 'drop table']],
    'страница ноль' => [['page' => '0']],
    'страница-текст' => [['page' => 'two']],
    'флаги не единицей' => [['ship' => 'yes', 'negotiable' => '0']],
    'запрос массивом' => [['q' => ['a']]],
]);

it('сортировка «рядом» не принимается: решения по геопозиции нет', function () {
    expect(FleaFilters::fromQuery(['sort' => 'nearest'])->sort)->toBeNull()
        ->and(FleaFilters::fromQuery(['sort' => '_geoPoint'])->sort)->toBeNull();
});

it('сортировки адреса соответствуют сортировкам индекса', function () {
    expect(FleaSort::Newest->listingSort())->toBe(ListingSort::Newest)
        ->and(FleaSort::PriceAsc->listingSort())->toBe(ListingSort::PriceAsc)
        ->and(FleaSort::PriceDesc->listingSort())->toBe(ListingSort::PriceDesc)
        ->and(array_map(fn (FleaSort $sort) => $sort->value, FleaSort::cases()))->toBe(['new', 'cheap', 'expensive']);
});

it('слишком длинный запрос обрезается', function () {
    expect(mb_strlen(FleaFilters::fromQuery(['q' => str_repeat('я', 500)])->query))->toBe(100);
});

it('withoutConditions сбрасывает только состояние (для счётчиков чипов)', function () {
    $filters = FleaFilters::fromQuery(['condition' => ['mint'], 'ship' => '1', 'page' => '2'])->withoutConditions();

    expect($filters->conditions)->toBe([])
        ->and($filters->ship)->toBeTrue()
        ->and($filters->page)->toBe(2);
});
