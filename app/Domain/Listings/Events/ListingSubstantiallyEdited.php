<?php

declare(strict_types=1);

namespace App\Domain\Listings\Events;

/** Существенная правка опубликованного объявления (published → pending или published). */
final class ListingSubstantiallyEdited extends ListingTransitioned {}
