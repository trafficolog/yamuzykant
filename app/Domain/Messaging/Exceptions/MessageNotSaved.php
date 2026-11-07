<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Exceptions;

use RuntimeException;

/**
 * Сообщение не удалось сохранить из-за сбоя БД. Намеренно без SQL, параметров и предыдущего исключения:
 * QueryException и PDOException несут привязки (текст сообщения) и строку таблицы из ответа PostgreSQL,
 * а такое исключение уходит в журнал и в Sentry. Остаётся только SQLSTATE для диагностики.
 */
final class MessageNotSaved extends RuntimeException
{
    public function __construct(public readonly string $sqlState)
    {
        parent::__construct('Не удалось сохранить сообщение (SQLSTATE '.$sqlState.').');
    }
}
