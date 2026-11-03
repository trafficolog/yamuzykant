<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Exceptions;

use RuntimeException;

/**
 * Регистрация без подтверждённой почты (в сессии нет состояния «нужна регистрация»).
 */
final class RegistrationNotPending extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('No pending registration in session.');
    }
}
