<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Вход по коду на почту (SPEC UC-A1, ARCHITECTURE §7)
    |--------------------------------------------------------------------------
    */

    // Время жизни кода, секунды. 10 мин — значение из SPEC, «уточнить» у OWNER.
    'code_ttl' => 600,

    // Хранилище хэшей кодов, счётчиков и блокировок (store из config/cache.php).
    // В production и e2e — Redis, в Pest — array (phpunit.xml).
    'code_store' => env('LOGIN_CODE_STORE', 'redis'),

    // Фиксированный код для автотестов. Действует ТОЛЬКО при APP_ENV из закрытого
    // списка LoginCodeGenerator::FAKE_ENVIRONMENTS (testing, e2e); в любом другом
    // окружении игнорируется.
    'code_fake' => env('LOGIN_CODE_FAKE'),

    // Очередь письма с кодом: высокий приоритет, воркеры слушают `high,default`.
    'mail_queue' => 'high',

    'limits' => [
        // Коды на один адрес и с одного IP за окно (SPEC §9: 5 в час на адрес, 20 на IP).
        'codes_per_email' => 5,
        'codes_per_ip' => 20,
        'codes_window' => 3600,

        // Неверные коды подряд до блокировки и длительность блокировки, секунды (ARCHITECTURE §7).
        'max_failed_attempts' => 5,
        'lockout' => 900,
    ],

    // Версия документа согласия с правилами и политикой обработки ПДн, которая пишется
    // в users.consent_version при первом входе. ПЛЕЙСХОЛДЕР — значение даёт OWNER.
    'consent_version' => 'draft-2026-11',

];
