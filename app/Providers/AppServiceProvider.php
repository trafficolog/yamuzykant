<?php

declare(strict_types=1);

namespace App\Providers;

use App\Domain\Accounts\Listeners\RememberSessionVersion;
use App\Domain\Accounts\Staff\NoStaff;
use App\Domain\Accounts\Staff\StaffDirectory;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Photos\HeicConverter;
use App\Domain\Listings\Photos\ImagickHeicConverter;
use App\Domain\Listings\Photos\PhotoStorage;
use App\Domain\Listings\Photos\PhotoUploads;
use App\Domain\Listings\Photos\S3PresignedUploads;
use App\Domain\Listings\Photos\SignedRouteUploads;
use App\Domain\Listings\Policies\ListingPolicy;
use App\Support\Flags\FeatureFlag;
use Illuminate\Auth\Events\Login;
use Illuminate\Filesystem\AwsS3V3Adapter;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Laravel\Pennant\Feature;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Сотрудники — заглушка до staff-guard (5.3.1).
        $this->app->bind(StaffDirectory::class, NoStaff::class);

        // Фото: S3 — прямая загрузка по presigned PUT; другой диск (тесты, e2e) — через подписанный маршрут.
        $this->app->bind(PhotoUploads::class, function (): PhotoUploads {
            $disk = PhotoStorage::disk();

            return $disk instanceof AwsS3V3Adapter
                ? new S3PresignedUploads($disk->getClient(), Config::string('filesystems.disks.'.Config::string('photos.disk').'.bucket'))
                : new SignedRouteUploads;
        });
        $this->app->bind(HeicConverter::class, ImagickHeicConverter::class);
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

        // Политики домена лежат в app/Domain/*/Policies — регистрируем явно, а не по соглашению имён.
        Gate::policy(Listing::class, ListingPolicy::class);
    }
}
