<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Exceptions;

use DomainException;

/** В беседу больше нельзя писать: объявление не опубликовано или собеседник удалил аккаунт. */
final class ConversationClosed extends DomainException
{
    public static function listingNotPublished(): self
    {
        return new self((string) __('messaging.errors.listing_closed'));
    }

    public static function counterpartDeleted(): self
    {
        return new self((string) __('messaging.errors.counterpart_deleted'));
    }
}
