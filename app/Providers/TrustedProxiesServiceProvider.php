<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Support\ServiceProvider;

/**
 * Доверенные прокси (задача 0.1.4). Перед stage нет прокси и CDN (решение OWNER 03.11.2026):
 * X-Forwarded-* принимаются только от 127.0.0.1, иначе клиент подделал бы свой IP для лимитов.
 * Появится балансировщик или CDN — их адреса добавляются сюда отдельной задачей.
 */
final class TrustedProxiesServiceProvider extends ServiceProvider
{
    /** @var list<string> */
    public const PROXIES = ['127.0.0.1'];

    public function boot(): void
    {
        TrustProxies::at(self::PROXIES);
    }
}
