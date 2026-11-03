<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Data;

enum LoginStatus: string
{
    case Authenticated = 'authenticated';
    case RegistrationRequired = 'registration_required';
}
