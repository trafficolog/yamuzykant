<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Data;

enum LoginStatus: string
{
    case Authenticated = 'authenticated';
    case RegistrationRequired = 'registration_required';

    /** Яндекс ID не отдал почту: шаг «Введите почту» с подтверждением кодом (UC-A1, 1a). */
    case EmailRequired = 'email_required';
}
