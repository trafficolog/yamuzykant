<?php

declare(strict_types=1);

// Laravel Scout: индекс моделей справочника для подсказки (задача 1.2.2). Индекс листингов — задача 3.1.1.
return [
    'driver' => env('SCOUT_DRIVER', 'meilisearch'),

    // Префикс имён индексов: в тестах `test_`, чтобы не трогать индекс разработки.
    'prefix' => env('SCOUT_PREFIX', ''),

    // Синхронизация индекса — через очередь (job MakeSearchable). В тестах SCOUT_QUEUE=false: синхронно.
    'queue' => env('SCOUT_QUEUE', true),

    'after_commit' => false,

    'chunk' => [
        'searchable' => 500,
        'unsearchable' => 500,
    ],

    'soft_delete' => false,

    'meilisearch' => [
        'host' => env('MEILISEARCH_HOST', 'http://localhost:7700'),
        'key' => env('MEILISEARCH_KEY'),
        'index-settings' => [
            // Применяет `php artisan scout:sync-index-settings` (при деплое и в тестах).
            // Синонимы («стратокастер» → Stratocaster) заложены в документ: поле `aliases` из config/catalog.php.
            'instrument_models' => [
                'searchableAttributes' => ['brand', 'name', 'aliases'],
                'filterableAttributes' => ['category_id'],
                'typoTolerance' => ['enabled' => true],
            ],
        ],
    ],
];
