<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Staff;

use App\Domain\Accounts\Models\User;

/**
 * Кто сотрудник площадки. До staff-guard и ролей консоли (5.3.1) — заглушка NoStaff.
 */
interface StaffDirectory
{
    public function isStaff(User $user): bool;
}
