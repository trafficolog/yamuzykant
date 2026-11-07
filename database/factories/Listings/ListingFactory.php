<?php

declare(strict_types=1);

namespace Database\Factories\Listings;

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\City;
use App\Domain\Catalog\Models\InstrumentModel;
use App\Domain\Listings\Enums\Condition;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Пример из прототипа: Fender ’57 Stratocaster за 184 500 ₽, Москва.
 *
 * @extends Factory<Listing>
 */
class ListingFactory extends Factory
{
    protected $model = Listing::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'status' => ListingStatus::Draft,
            'category_id' => Category::factory(),
            'model_id' => InstrumentModel::factory(),
            'title' => 'Fender ’57 Stratocaster',
            'year' => 1957,
            'serial_enc' => 'V091234',
            'condition' => Condition::Excellent,
            'description' => 'Родной кейс, оригинальные звукосниматели.',
            'price' => 184_500,
            'negotiable' => true,
            'meet' => true,
            'ship' => false,
            'city_id' => City::factory(),
            'published_at' => null,
        ];
    }

    /**
     * Объявление сразу в нужном статусе — данные для тестов, в обход машины (как строка, пришедшая из БД).
     */
    public function inStatus(ListingStatus $status): static
    {
        return $this->state(fn (): array => [
            'status' => $status,
            'published_at' => in_array($status, [ListingStatus::Published, ListingStatus::Withdrawn, ListingStatus::Expired], true)
                ? now()->subDays(3)
                : null,
            // Ушло из published вчера; тесты окна ответов задают момент явно.
            'unpublished_at' => in_array($status, [ListingStatus::Withdrawn, ListingStatus::Expired], true)
                ? now()->subDay()
                : null,
        ]);
    }
}
