<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Data;

use Illuminate\Support\Facades\Config;

/**
 * Адрес возврата к прерванному действию — только относительный путь внутри приложения.
 */
final class ReturnPath
{
    /**
     * Абсолютный URL допускается лишь со схемой http(s) и хостом из APP_URL и сводится к пути;
     * всё остальное (чужой хост, //host, обратный слэш, javascript:, не строка) — главная.
     */
    public static function sanitize(mixed $url): string
    {
        if (! is_string($url) || $url === '' || preg_match('/[\x00-\x1F\x7F\\\\]/', $url) === 1) {
            return '/';
        }

        $parts = parse_url($url);
        if ($parts === false) {
            return '/';
        }

        if (isset($parts['scheme']) || isset($parts['host'])) {
            $appHost = parse_url(Config::string('app.url'), PHP_URL_HOST);
            $scheme = strtolower($parts['scheme'] ?? '');

            if (! in_array($scheme, ['http', 'https'], true) || ($parts['host'] ?? null) !== $appHost) {
                return '/';
            }
        }

        $path = $parts['path'] ?? '/';
        if (! str_starts_with($path, '/') || str_starts_with($path, '//')) {
            return '/';
        }

        return isset($parts['query']) ? $path.'?'.$parts['query'] : $path;
    }
}
