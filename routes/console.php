<?php

declare(strict_types=1);

use App\Domain\Listings\Actions\ExpireListings;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// SPEC §6.1: published → expired через config listings.expire_after_days. Ежечасно — опоздание не больше часа.
Schedule::call(fn () => app(ExpireListings::class)())
    ->name('listings:expire')
    ->hourly()
    ->withoutOverlapping()
    ->onOneServer();
