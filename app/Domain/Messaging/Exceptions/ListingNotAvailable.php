<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Exceptions;

use DomainException;

/**
 * Объявление не в published: начать по нему чат нельзя. Наружу — 404, как у отсутствующего
 * (решение OWNER 07.11.2026, SPEC §6.1): статус чужого объявления не раскрывается.
 */
final class ListingNotAvailable extends DomainException {}
