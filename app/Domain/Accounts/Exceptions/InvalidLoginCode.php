<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Exceptions;

use RuntimeException;

/**
 * Код неверный, истёк или не запрашивался. Причина намеренно не уточняется.
 */
final class InvalidLoginCode extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Invalid login code.');
    }
}
