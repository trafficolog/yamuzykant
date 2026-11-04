<?php

declare(strict_types=1);

namespace App\Providers;

use App\Domain\Accounts\Listeners\RememberSessionVersion;
use App\Domain\Accounts\Staff\NoStaff;
use App\Domain\Accounts\Staff\StaffDirectory;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Policies\ListingPolicy;
use App\Domain\Search\Console\BenchmarkSearchCommand;
use App\Domain\Search\Console\ReconcileListingIndexCommand;
use App\Domain\Search\Console\SeedLoadListingsCommand;
use App\Domain\Search\Listeners\QueueListingIndexSync;
use App\Support\Flags\FeatureFlag;
use App\Support\YandexId\YandexOAuth;
use Illuminate\Auth\Events\Login;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
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
        // Сотрудники — заглушка до staff-guard (5.3.1).
        $this->app->bind(StaffDirectory::class, NoStaff::class);
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

        // Поисковый индекс объявлений: любое событие машины статусов → job SyncListingToIndex.
        Event::listen('App\Domain\Listings\Events\*', QueueListingIndexSync::class);

        if ($this->app->runningInConsole()) {
            $this->commands([
                ReconcileListingIndexCommand::class,
                SeedLoadListingsCommand::class,
                BenchmarkSearchCommand::class,
            ]);
        }

        // Политики домена лежат в app/Domain/*/Policies — регистрируем явно, а не по соглашению имён.
        Gate::policy(Listing::class, ListingPolicy::class);

        // Яндекс ID: настоящий провайдер или подменный (YANDEX_OAUTH_FAKE только в testing и e2e).
        Socialite::extend(YandexOAuth::DRIVER, fn (Application $app): AbstractProvider => YandexOAuth::makeProvider($app->make(Request::class)));
    }
}
