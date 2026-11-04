<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Exceptions;

use RuntimeException;

/**
 * Возврат от Яндекса с неверным, повторным или отсутствующим `state`: вход не выполняется (403).
 */
final class InvalidYandexState extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Invalid OAuth state for Yandex ID login.');
    }
}
