<?php

declare(strict_types=1);

use Tests\TestCase;

pest()->extend(TestCase::class)->in('Feature', 'Unit');

// Живые проверки сервисов compose: нужен запущенный `docker compose`. Запуск: composer test:docker.
pest()->group('docker')->in('Feature/LocalEnv/LocalServicesTest.php');
