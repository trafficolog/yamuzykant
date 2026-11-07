<?php

declare(strict_types=1);

use App\Support\Observability\SentryScrubber;

/**
 * Sentry PHP (0.1.5). Без SENTRY_LARAVEL_DSN SDK выключен: события никуда не уходят (так в CI и локально).
 *
 * @see https://docs.sentry.io/platforms/php/guides/laravel/configuration/options/
 */

// Релиз = git sha. Выкатка (deploy.sh) раскладывает код в releases/<UTC>-<sha12>, отсюда берётся sha;
// SENTRY_RELEASE, если задана, главнее.
$releaseFromPath = preg_match('/-([0-9a-f]{12})$/', basename((string) realpath(base_path())), $matches) === 1
    ? $matches[1]
    : null;

return [

    'dsn' => env('SENTRY_LARAVEL_DSN') ?: null,

    'release' => env('SENTRY_RELEASE') ?: $releaseFromPath,

    // Пусто — берётся APP_ENV.
    'environment' => env('SENTRY_ENVIRONMENT'),

    'sample_rate' => env('SENTRY_SAMPLE_RATE') === null ? 1.0 : (float) env('SENTRY_SAMPLE_RATE'),

    'traces_sample_rate' => env('SENTRY_TRACES_SAMPLE_RATE') === null ? null : (float) env('SENTRY_TRACES_SAMPLE_RATE'),

    // ПДн (IP, куки, пользователь) SDK сам не собирает; остальное чистит beforeSend.
    'send_default_pii' => false,

    // Callable-массив, а не замыкание: конфигурация кэшируется (config:cache).
    'before_send' => [SentryScrubber::class, 'beforeSend'],

    'ignore_transactions' => ['/up', '/health'],

    'breadcrumbs' => [
        'logs' => true,
        'cache' => false,
        'livewire' => false,
        'sql_queries' => false,
        'sql_bindings' => false,
        'queue_info' => true,
        'command_info' => true,
        'http_client_requests' => true,
        'notifications' => false,
    ],

    'tracing' => [
        'sql_bindings' => false,
    ],
];
