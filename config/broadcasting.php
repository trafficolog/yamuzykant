<?php

declare(strict_types=1);

/*
 * Трансляция событий (ARCHITECTURE §6): Reverb. Без Reverb (Pest, CI php) — `null`.
 *
 * Вещатель `log` писал бы текст сообщений в журнал. Laravel подмешивает в этот файл свои соединения
 * (log, pusher, ably), поэтому `log` здесь переопределён на драйвер null: BROADCAST_CONNECTION=log ничего не пишет.
 */
return [

    // env() превращает строку «null» в null — значение по умолчанию подставляется явно.
    'default' => env('BROADCAST_CONNECTION') ?: 'null',

    'connections' => [

        'reverb' => [
            'driver' => 'reverb',
            'key' => env('REVERB_APP_KEY'),
            'secret' => env('REVERB_APP_SECRET'),
            'app_id' => env('REVERB_APP_ID'),
            // Куда приложение отправляет события: адрес сервера Reverb изнутри (может быть 127.0.0.1).
            'options' => [
                'host' => env('REVERB_HOST'),
                'port' => env('REVERB_PORT', 443),
                'scheme' => env('REVERB_SCHEME', 'https'),
                'useTLS' => env('REVERB_SCHEME', 'https') === 'https',
            ],
            'client_options' => [],
        ],

        'log' => [
            'driver' => 'null',
        ],

        'null' => [
            'driver' => 'null',
        ],

    ],

    /*
     * Куда подключается браузер (shared prop `realtime`). Читается во время запроса, а не при сборке Vite:
     * один и тот же бандл работает в CI e2e, на stage и в production. По умолчанию — как REVERB_*.
     */
    'client' => [
        'host' => env('REVERB_PUBLIC_HOST', env('REVERB_HOST')),
        'port' => (int) env('REVERB_PUBLIC_PORT', env('REVERB_PORT', 443)),
        'scheme' => env('REVERB_PUBLIC_SCHEME', env('REVERB_SCHEME', 'https')),
    ],

];
