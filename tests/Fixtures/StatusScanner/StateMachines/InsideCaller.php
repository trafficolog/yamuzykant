<?php

declare(strict_types=1);

namespace Tests\Fixtures\StatusScanner\StateMachines;

final class InsideCaller
{
    public function run(object $listing): void
    {
        $listing->withStatusChange(fn () => true);
    }
}
