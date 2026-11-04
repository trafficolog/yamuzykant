<?php

declare(strict_types=1);

namespace App\Domain\Listings\Events;

/** Продавец исправил объявление после возврата (needs_changes → pending или published). */
final class ListingResubmitted extends ListingTransitioned {}
