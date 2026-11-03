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

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->city(),
            'slug' => fake()->unique()->slug(),
            'region' => fake()->word().' область',
            'lat' => fake()->latitude(41, 70),
            'lng' => fake()->longitude(20, 170),
        ];
    }
}
