<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

pest()->extend(TestCase::class)->in('Feature', 'Unit');

// Страницы Inertia читают фича-флаги из таблицы `features`, поэтому эти тесты работают с БД.
// HealthTest в списке нет: он проверяет /health без базы данных.
uses(RefreshDatabase::class)->in(
    'Feature/DsShowcaseTest.php',
    'Feature/FeatureFlagsTest.php',
    'Feature/HomeTest.php',
);

// Живые проверки сервисов compose: нужен запущенный `docker compose`. Запуск: composer test:docker.
pest()->group('docker')->in('Feature/LocalEnv/LocalServicesTest.php');
