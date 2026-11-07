<?php

declare(strict_types=1);

namespace Tests\Fixtures\StatusScanner\StateMachines;

use App\Domain\Listings\Models\Listing;

final class InsideCaller
{
    public function run(Listing $listing): void
    {
        $listing->withStatusChange(fn () => true);
    }
}
