<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Exceptions;

use RuntimeException;

/** Пользователь начал больше новых бесед за сутки, чем разрешено (config messaging.new_chats_per_day). */
final class NewChatLimitReached extends RuntimeException
{
    public function __construct()
    {
        parent::__construct((string) __('messaging.errors.new_chats_limit'));
    }
}
