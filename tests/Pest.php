<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

pest()->extend(TestCase::class)->in('Feature', 'Unit');

// Каждая страница Inertia читает фича-флаги из таблицы `features`, поэтому HTTP-тесты работают с БД.
uses(RefreshDatabase::class)->in('Feature');
