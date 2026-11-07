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
            // Объявления (ARCHITECTURE §5). `aliases` — русские написания моделей (ModelAliases), вместо synonyms.
            'listings' => [
                'searchableAttributes' => ['title', 'model', 'brand', 'aliases', 'description'],
                'filterableAttributes' => ['category_path', 'condition', 'price', 'city_id', 'ship', 'negotiable', '_geo'],
                'sortableAttributes' => ['published_at', 'price', '_geo'],
                // `words` первым: сортировка по цене и дате действует среди совпавших по всем словам запроса,
                // а не ставит выше случайное объявление, где совпало одно слово из трёх.
                'rankingRules' => ['words', 'sort', 'typo', 'proximity', 'attribute', 'exactness'],
                'stopWords' => [
                    'и', 'в', 'во', 'на', 'с', 'со', 'к', 'у', 'о', 'об', 'по', 'от', 'из', 'за', 'до', 'для', 'при', 'без',
                    'под', 'над', 'или', 'но', 'а', 'это',
                ],
                'typoTolerance' => ['enabled' => true],
                // Точное общее число для «Найдено N»: по умолчанию Meilisearch обрезает его на 1000.
                'pagination' => ['maxTotalHits' => 10000],
            ],
        ],
    ],
];
