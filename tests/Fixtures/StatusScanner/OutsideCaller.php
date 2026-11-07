<?php

declare(strict_types=1);

namespace Tests\Fixtures\StatusScanner;

final class OutsideCaller
{
    public function run(object $listing): void
    {
        $listing->withStatusChange(fn () => true);
    }
}
