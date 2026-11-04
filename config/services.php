<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    // Вход через Яндекс ID (1.1.5, ARCHITECTURE §7). Значения — GitHub Secrets / хранилище окружения.
    'yandex' => [
        'client_id' => env('YANDEX_CLIENT_ID', ''),
        'client_secret' => env('YANDEX_CLIENT_SECRET', ''),
        // Адрес возврата Яндексу — только отсюда, никогда из запроса.
        'redirect' => env('YANDEX_REDIRECT_URI', rtrim((string) env('APP_URL', 'http://localhost'), '/').'/auth/yandex/callback'),
        // Подменный провайдер для CI и e2e. Действует ТОЛЬКО при APP_ENV из закрытого списка
        // YandexOAuth::FAKE_ENVIRONMENTS (testing, e2e); в любом другом окружении игнорируется.
        'fake' => (bool) env('YANDEX_OAUTH_FAKE', false),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
