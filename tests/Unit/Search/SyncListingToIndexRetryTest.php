<?php

declare(strict_types=1);

use App\Domain\Search\Jobs\SyncListingToIndex;
use Tests\TestCase;

uses()->group(TestCase::NO_DATABASE_GROUP);

it('SyncListingToIndex повторяется до retryUntil (60 с), а не по числу попыток', function () {
    $job = new SyncListingToIndex('listing-id');

    // Занятый замок WithoutOverlapping считает release() как попытку: при $tries событие терялось бы до ночной сверки.
    expect((new ReflectionClass($job))->hasProperty('tries'))->toBeFalse();
    expect($job->retryUntil()->getTimestamp())
        ->toBeGreaterThanOrEqual(now()->addSeconds(59)->getTimestamp())
        ->toBeLessThanOrEqual(now()->addSeconds(61)->getTimestamp());
});
