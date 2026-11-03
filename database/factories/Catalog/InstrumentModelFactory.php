<?php

declare(strict_types=1);

namespace Database\Factories\Catalog;

use App\Domain\Catalog\Enums\InstrumentModelStatus;
use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\InstrumentModel;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InstrumentModel>
 */
class InstrumentModelFactory extends Factory
{
    protected $model = InstrumentModel::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'brand' => fake()->unique()->company(),
            'name' => fake()->unique()->bothify('Model ??-###'),
            'year_from' => null,
            'year_to' => null,
            'category_id' => Category::factory(),
            'status' => InstrumentModelStatus::Active,
        ];
    }

    public function suggested(): static
    {
        return $this->state(['status' => InstrumentModelStatus::Suggested]);
    }

    /** Модель, скрытая сотрудником (статус hidden). */
    public function hiddenStatus(): static
    {
        return $this->state(['status' => InstrumentModelStatus::Hidden]);
    }
}
