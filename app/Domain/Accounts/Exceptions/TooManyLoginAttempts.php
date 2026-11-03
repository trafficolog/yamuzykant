<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Exceptions;

use RuntimeException;

/**
 * Превышен лимит запросов кода или неверных кодов. HTTP-ответ — 429 (bootstrap/app.php).
 */
final class TooManyLoginAttempts extends RuntimeException
{
    public function __construct(public readonly int $retryAfter)
    {
        parent::__construct('Too many login attempts.');
    }

    /**
     * Сколько минут ждать, с округлением вверх, минимум 1.
     */
    public function minutes(): int
    {
        return max(1, (int) ceil($this->retryAfter / 60));
    }
}
