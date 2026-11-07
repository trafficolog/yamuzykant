<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Exceptions;

use DomainException;

/** Продавец не может начать чат по своему объявлению (UC-D1). */
final class CannotMessageYourself extends DomainException
{
    public function __construct()
    {
        parent::__construct((string) __('messaging.errors.self'));
    }
}
