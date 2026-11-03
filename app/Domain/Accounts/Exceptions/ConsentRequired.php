<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Exceptions;

use RuntimeException;

/**
 * Без согласия с правилами и политикой обработки ПДн аккаунт не создаётся (SPEC UC-A1, §9).
 */
final class ConsentRequired extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Consent is required to create an account.');
    }
}
