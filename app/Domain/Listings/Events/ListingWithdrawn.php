<?php

declare(strict_types=1);

namespace App\Domain\Listings\Events;

/** Объявление снято с продажи (published → withdrawn). */
final class ListingWithdrawn extends ListingTransitioned {}
