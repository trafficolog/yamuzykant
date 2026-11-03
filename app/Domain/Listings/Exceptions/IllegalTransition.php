<?php

declare(strict_types=1);

namespace App\Domain\Listings\Exceptions;

use App\Domain\Listings\Enums\ListingEvent;
use App\Domain\Listings\Enums\ListingStatus;
use DomainException;

/**
 * Событие недопустимо из текущего статуса объявления (нет такой стрелки в SPEC §6.1).
 */
final class IllegalTransition extends DomainException
{
    public function __construct(
        public readonly ListingStatus $from,
        public readonly ListingEvent $event,
    ) {
        parent::__construct(sprintf('Переход «%s» недопустим из статуса «%s».', $event->value, $from->value));
    }
}
