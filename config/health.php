<?php

declare(strict_types=1);

return [

    // Токен для подробного ответа /health снаружи (заголовок X-Health-Token). Пусто — подробности
    // отдаются только с 127.0.0.1 (проверки deploy.sh и мониторинг на самом сервере).
    'token' => env('HEALTH_TOKEN') ?: null,

    // Лимит запросов к /health с одного адреса в минуту: каждый запрос трогает БД, Redis и Meilisearch.
    'throttle_per_minute' => 60,

    // Хранилище счётчиков лимита. Файловое, чтобы недоступный Redis не превращал /health в 500.
    'throttle_store' => env('APP_ENV') === 'testing' ? 'array' : 'file',
];
