<?php

declare(strict_types=1);

namespace App\Domain\Listings\Events;

/** Модератор вернул объявление на доработку с причиной (pending → needs_changes). */
final class ListingReturned extends ListingTransitioned {}
