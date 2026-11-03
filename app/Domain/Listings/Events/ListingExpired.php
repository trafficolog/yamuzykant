<?php

declare(strict_types=1);

namespace App\Domain\Listings\Events;

/** Срок показа объявления истёк (published → expired). */
final class ListingExpired extends ListingTransitioned {}
