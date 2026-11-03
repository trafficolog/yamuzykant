<?php

declare(strict_types=1);

namespace App\Domain\Listings\Events;

/** Истёкшее объявление продлено (expired → pending или published). */
final class ListingRenewed extends ListingTransitioned {}
