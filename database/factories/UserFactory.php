<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Domain\Accounts\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /** @var class-string<User> */
    protected $model = User::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->firstName(),
            'email' => fake()->unique()->safeEmail(),
            'consent_version' => 'factory',
            'consented_at' => now(),
        ];
    }
}
