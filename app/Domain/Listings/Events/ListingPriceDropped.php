<?php

declare(strict_types=1);

namespace App\Domain\Listings\Events;

/** Снижение цены опубликованного объявления (published → published). */
final class ListingPriceDropped extends ListingTransitioned {}
