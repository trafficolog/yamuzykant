<?php

declare(strict_types=1);

namespace App\Domain\Listings\Events;

/** Модератор одобрил объявление (pending → published). */
final class ListingApproved extends ListingTransitioned {}
