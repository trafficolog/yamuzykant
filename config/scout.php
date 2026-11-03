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
            'instrument_models' => [
                'searchableAttributes' => ['brand', 'name'],
                'filterableAttributes' => ['category_id'],
                'typoTolerance' => ['enabled' => true],
                // Русские названия и сокращения → латиница. Ключ и значение пишутся в обе стороны, где это нужно.
                'synonyms' => [
                    'стратокастер' => ['stratocaster', 'strat'],
                    'stratocaster' => ['стратокастер'],
                    'телекастер' => ['telecaster', 'tele'],
                    'telecaster' => ['телекастер'],
                    'лес пол' => ['les paul', 'lespaul'],
                    'les paul' => ['лес пол'],
                    'фендер' => ['fender'],
                    'fender' => ['фендер'],
                    'гибсон' => ['gibson'],
                    'gibson' => ['гибсон'],
                    'ибанез' => ['ibanez'],
                    'ibanez' => ['ибанез'],
                    'ямаха' => ['yamaha'],
                    'yamaha' => ['ямаха'],
                    'роланд' => ['roland'],
                    'roland' => ['роланд'],
                    'маршалл' => ['marshall'],
                    'marshall' => ['маршалл'],
                    'бос' => ['boss'],
                    'boss' => ['бос'],
                    'биг маф' => ['big muff'],
                    'big muff' => ['биг маф'],
                    'туб скример' => ['tube screamer'],
                    'tube screamer' => ['туб скример'],
                ],
            ],
        ],
    ],
];
