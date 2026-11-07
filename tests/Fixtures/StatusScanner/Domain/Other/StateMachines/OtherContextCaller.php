<?php

declare(strict_types=1);

namespace Tests\Fixtures\StatusScanner\Domain\Other\StateMachines;

use App\Domain\Listings\Models\Listing;

final class OtherContextCaller
{
    public function run(Listing $listing): void
    {
        $listing->withStatusChange(fn () => true);
    }
}
