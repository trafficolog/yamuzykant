<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Exceptions;

use RuntimeException;

/**
 * Пользователь отказался в Яндексе или Яндекс ответил ошибкой: возврат в окно входа.
 */
final class YandexLoginFailed extends RuntimeException
{
    public function __construct(string $reason)
    {
        parent::__construct('Yandex ID login failed: '.$reason);
    }
}
