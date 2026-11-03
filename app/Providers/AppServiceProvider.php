<?php

declare(strict_types=1);

namespace App\Providers;

use App\Domain\Accounts\Listeners\RememberSessionVersion;
use App\Domain\Accounts\YandexLogin\YandexOAuth;
use App\Support\Flags\FeatureFlag;
use Illuminate\Auth\Events\Login;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Laravel\Pennant\Feature;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\AbstractProvider;

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

        // Яндекс ID: настоящий провайдер или подменный (YANDEX_OAUTH_FAKE только в testing и e2e).
        Socialite::extend(YandexOAuth::DRIVER, fn (Application $app): AbstractProvider => YandexOAuth::makeProvider($app->make(Request::class)));
    }
}
