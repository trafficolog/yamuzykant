<?php

declare(strict_types=1);

namespace Database\Factories\Catalog;

use App\Domain\Catalog\Models\City;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<City>
 */
class CityFactory extends Factory
{
    protected $model = City::class;

    /** Счётчик: Faker->unique() исчерпывается (слов и городов сотни), а пара (name, region) и slug должны быть уникальны. */
    private static int $sequence = 0;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $number = ++self::$sequence;

        return [
            'name' => fake()->city(),
            'slug' => 'gorod-'.$number,
            'region' => 'Область '.$number,
            'lat' => fake()->latitude(41, 70),
            'lng' => fake()->longitude(20, 170),
        ];
    }
}
