<?php

declare(strict_types=1);

namespace App\Domain\Listings\Events;

/** Снятое объявление возвращено в продажу (withdrawn → pending или published). */
final class ListingRelisted extends ListingTransitioned {}
