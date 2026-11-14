<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Actions;

use App\Domain\Accounts\Models\User;

/**
 * Имя и город пользователя (UC-A2). Почта, Яндекс ID и согласие здесь не меняются: почта — отдельной карточкой
 * с подтверждением кодом (1.1.1), остальное — вход и регистрация. Существование города проверяет форма.
 */
final class UpdateProfile
{
    public function handle(User $user, string $name, ?int $cityId): void
    {
        $user->forceFill(['name' => trim($name), 'city_id' => $cityId])->save();
    }
}
