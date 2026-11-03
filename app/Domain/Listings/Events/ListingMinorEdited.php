<?php

declare(strict_types=1);

namespace App\Domain\Listings\Events;

/** Несущественная правка опубликованного объявления (published → published). */
final class ListingMinorEdited extends ListingTransitioned {}
