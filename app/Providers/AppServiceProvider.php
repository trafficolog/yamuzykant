<?php

declare(strict_types=1);

namespace App\Providers;

use App\Domain\Accounts\Listeners\RememberSessionVersion;
use App\Support\Flags\FeatureFlag;
use Illuminate\Auth\Events\Login;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\ServiceProvider;
use Laravel\Pennant\Feature;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Значение по умолчанию — выключено; включение хранится в таблице `features`.
        foreach (FeatureFlag::cases() as $flag) {
            Feature::define($flag->value, fn (): bool => false);
        }

        // Версия сессий в сессии при любом входе — для «выйти на всех устройствах».
        Event::listen(Login::class, RememberSessionVersion::class);

        // Время постановки задания в очередь: по нему /health считает возраст старейшего задания в Redis.
        Queue::createPayloadUsing(static fn (): array => ['pushed_at' => time()]);
    }
}
