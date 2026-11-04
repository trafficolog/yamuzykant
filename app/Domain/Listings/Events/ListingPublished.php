<?php

declare(strict_types=1);

namespace App\Domain\Listings\Events;

/** Черновик опубликован (draft → published) или отправлен на проверку (draft → pending). */
final class ListingPublished extends ListingTransitioned {}
