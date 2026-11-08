<?php

declare(strict_types=1);

use App\Domain\Catalog\Models\City;
use Tests\Support\ListingFixtures;

// Карточка 3.1.8: тест мигал в CI из-за cities_name_region_unique — регион в фабрике брался из ~180 слов Faker.

it('города с одним названием создаются без нарушения cities_name_region_unique', function () {
    City::factory()->count(400)->create(['name' => 'Москва']);

    expect(City::query()->where('name', 'Москва')->count())->toBe(400);
});

it('фикстура города поиска создаётся много раз подряд с одним названием', function () {
    foreach (range(1, 300) as $_) {
        ListingFixtures::city('Москва');
    }

    expect(City::query()->where('name', 'Москва')->count())->toBe(300);
});
