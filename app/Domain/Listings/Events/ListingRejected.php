<?php

declare(strict_types=1);

namespace App\Domain\Listings\Events;

/** Модератор отклонил объявление с причиной (pending → rejected). */
final class ListingRejected extends ListingTransitioned {}
