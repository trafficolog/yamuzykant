<?php

declare(strict_types=1);

use App\Domain\Listings\Actions\ExpireListings;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// SPEC §6.1: published → expired через config listings.expire_after_days. Можно запустить вручную.
Artisan::command('listings:expire', function (ExpireListings $expire) {
    $this->info('Снято по сроку: '.$expire());
})->purpose('Перевести в expired объявления, опубликованные дольше срока показа');

// Ежечасно — опоздание не больше часа; без наложения запусков.
Schedule::command('listings:expire')
    ->hourly()
    ->withoutOverlapping()
    ->onOneServer();

// ARCHITECTURE §5: ночная сверка БД и индекса объявлений — догоняет потерянные события job-а синхронизации.
Schedule::command('listings:reconcile-index')
    ->dailyAt('03:30')
    ->withoutOverlapping()
    ->onOneServer();
