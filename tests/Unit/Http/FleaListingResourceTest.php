<?php

declare(strict_types=1);

use App\Http\Resources\Listings\FleaListingResource;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

// Ревью 3.1.1: сырой документ индекса в UI не уходит — только белый список полей карточки.

/** @return array<string, mixed> */
function rawHit(): array
{
    return [
        'id' => '0199aaaa-0000-7000-8000-000000000001',
        'title' => 'Fender ’57 Stratocaster',
        'model' => 'American Vintage ’57 Stratocaster',
        'brand' => 'Fender',
        'aliases' => ['стратокастер'],
        'description' => 'Родной кейс.',
        'category_path' => ['gitary', 'gitary/elektrogitary'],
        'condition' => 'excellent',
        'price' => 184_500,
        'city_id' => 1,
        'ship' => true,
        'negotiable' => true,
        'published_at' => Carbon::parse('2026-11-07 10:00:00', 'UTC')->getTimestamp(),
        '_geo' => ['lat' => 55.7558, 'lng' => 37.6173],
        // Чего в документе быть не должно, но Resource не вправе пропустить, даже если оно туда попало:
        'serial_enc' => 'V091234',
        'serial' => 'V091234',
        'email' => 'seller@example.com',
        'user_id' => 42,
        'final_price' => 170_000,
        '_rankingScore' => 0.9,
    ];
}

it('отдаёт ровно поля карточки', function () {
    Carbon::setTestNow('2026-11-07 12:00:00');

    $card = (new FleaListingResource(rawHit(), 'Москва'))->resolve(Request::create('/baraholka'));

    expect($card)->toBe([
        'id' => '0199aaaa-0000-7000-8000-000000000001',
        'title' => 'Fender ’57 Stratocaster',
        'price' => 184_500,
        'condition' => 'excellent',
        'city' => 'Москва',
        'ship' => true,
        'negotiable' => true,
        'posted' => '2 ч назад',
    ]);

    Carbon::setTestNow();
});

it('серийный номер, почта, user_id, итоговая цена, описание и геоточка наружу не уходят', function () {
    $json = json_encode((new FleaListingResource(rawHit(), 'Москва'))->resolve(Request::create('/baraholka')), JSON_THROW_ON_ERROR);

    expect($json)->not->toContain('V091234')
        ->not->toContain('seller@example.com')
        ->not->toContain('user_id')
        ->not->toContain('final_price')
        ->not->toContain('170000')
        ->not->toContain('Родной кейс')
        ->not->toContain('_geo')
        ->not->toContain('aliases');
});

it('неполный документ даёт пустые, а не отсутствующие поля', function () {
    $card = (new FleaListingResource(['id' => 'x'], 'Москва'))->resolve(Request::create('/baraholka'));

    expect($card)->toMatchArray([
        'id' => 'x',
        'title' => '',
        'price' => null,
        'condition' => null,
        'ship' => false,
        'negotiable' => false,
        'posted' => null,
    ]);
});
