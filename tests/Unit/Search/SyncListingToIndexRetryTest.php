<?php

declare(strict_types=1);

use App\Domain\Search\Jobs\SyncListingToIndex;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

// release() занятого замка WithoutOverlapping считается попыткой, поэтому лимит попыток большой, а падение
// по исключениям ограничено отдельно ($maxExceptions). Время ожидания в очереди (retryUntil от постановки)
// не годится: задание, простоявшее больше минуты, упало бы без единой попытки.

it('SyncListingToIndex: запас попыток на занятый замок и отдельный предел для исключений', function () {
    $job = new SyncListingToIndex('listing-id');

    expect($job->tries)->toBeGreaterThanOrEqual(20)
        ->and($job->maxExceptions)->toBeGreaterThanOrEqual(3)->toBeLessThanOrEqual(5)
        ->and(method_exists($job, 'retryUntil'))->toBeFalse();
});

it('при занятом замке задание возвращается в очередь, а не падает', function () {
    config(['queue.default' => 'database']);
    $lock = Cache::lock('laravel-queue-overlap:'.SyncListingToIndex::class.':listing-busy', 60);
    expect($lock->get())->toBeTrue();

    dispatch(new SyncListingToIndex('listing-busy'));
    Artisan::call('queue:work', ['--once' => true, '--stop-when-empty' => true]);

    expect(DB::table('failed_jobs')->count())->toBe(0)
        ->and(DB::table('jobs')->count())->toBe(1);

    $lock->release();
});
