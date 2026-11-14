<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Exceptions;

use DomainException;

/**
 * В беседу нельзя писать: собеседник удалил аккаунт (BR-09). Статус объявления беседу не закрывает (BR-10,
 * решение OWNER 08.11.2026).
 */
final class ConversationClosed extends DomainException
{
    public static function counterpartDeleted(): self
    {
        return new self((string) __('messaging.errors.counterpart_deleted'));
    }
}
