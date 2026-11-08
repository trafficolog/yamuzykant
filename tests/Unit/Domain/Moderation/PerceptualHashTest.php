<?php

declare(strict_types=1);

use App\Domain\Moderation\AutoChecks\PerceptualHash;

// Расстояние Хэмминга между pHash из 16 hex-символов (64 бита) — основа проверки «дубль фото» (UC-O1).

it('считает биты, в которых хэши различаются', function (string $a, string $b, int $distance) {
    expect(PerceptualHash::distance($a, $b))->toBe($distance);
})->with([
    'одинаковые' => ['0123456789abcdef', '0123456789abcdef', 0],
    'один бит' => ['0000000000000000', '0000000000000001', 1],
    'старший бит' => ['0000000000000000', '8000000000000000', 1],
    'шесть бит' => ['0000000000000000', '000000000000003f', 6],
    'все биты' => ['0000000000000000', 'ffffffffffffffff', 64],
    'регистр букв не важен' => ['ABCDEF0123456789', 'abcdef0123456789', 0],
    'разные половины' => ['00000001ffffffff', '0000000000000000', 33],
]);

it('для хэша неверной длины или не hex не считает фото дублем', function (string $a, string $b) {
    expect(PerceptualHash::distance($a, $b))->toBe(PerceptualHash::MAX_DISTANCE);
})->with([
    'короткий' => ['0123', '0123456789abcdef'],
    'не hex' => ['zzzzzzzzzzzzzzzz', '0000000000000000'],
    'пустой' => ['', ''],
]);
