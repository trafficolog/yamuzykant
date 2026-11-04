<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Staff;

use App\Domain\Accounts\Models\User;

/**
 * Заглушка до staff-guard (5.3.1): пользователи сайта сотрудниками не бывают.
 */
final class NoStaff implements StaffDirectory
{
    public function isStaff(User $user): bool
    {
        return false;
    }
}
