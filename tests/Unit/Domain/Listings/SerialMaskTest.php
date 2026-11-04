<?php

declare(strict_types=1);

use App\Domain\Listings\Models\Listing;

it('маскирует серийный номер: первые 3 символа и ****', function (string $serial, string $masked) {
    $listing = new Listing;
    $listing->serial_enc = $serial;

    expect($listing->serialMasked())->toBe($masked);
})->with([
    'пример из SPEC' => ['V091234', 'V09****'],
    'длинный номер — длина не раскрывается' => ['US12345678901', 'US1****'],
    'пробелы по краям не считаются' => ['  V091234  ', 'V09****'],
    'кириллица' => ['ЯМ1234567', 'ЯМ1****'],
    'короткий номер: видно не больше, чем скрыто за 4 звёздами' => ['AB123', 'A****'],
    '4 символа и меньше — ничего не видно' => ['V091', '****'],
    'один символ' => ['7', '****'],
]);

it('без серийного номера маски нет', function (?string $serial) {
    $listing = new Listing;
    $listing->serial_enc = $serial;

    expect($listing->serialMasked())->toBeNull();
})->with(['null' => [null], 'пустая строка' => [''], 'только пробелы' => ['   ']]);

it('серийный номер не попадает в сериализацию модели', function () {
    $listing = new Listing;
    $listing->serial_enc = 'V091234';

    expect($listing->toArray())->not->toHaveKey('serial_enc')
        ->and($listing->toJson())->not->toContain('V091234');
});
