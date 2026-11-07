<?php

declare(strict_types=1);

namespace Tests\Fixtures\StatusScanner;

use App\Domain\Listings\Models\Listing;

final class OutsideCaller
{
    public function run(Listing $listing): void
    {
        $listing->withStatusChange(fn () => true);
    }
}
