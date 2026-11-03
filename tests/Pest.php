<?php

declare(strict_types=1);

use App\Domain\Accounts\Mail\LoginCodeMail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Pest\Support\HigherOrderTapProxy;
use Tests\TestCase;

pest()->extend(TestCase::class)->in('Feature', 'Unit');

// Страницы Inertia читают фича-флаги из таблицы `features`, поэтому эти тесты работают с БД.
// HealthTest в списке нет: он проверяет /health без базы данных.
uses(RefreshDatabase::class)->in(
    'Feature/DsShowcaseTest.php',
    'Feature/FeatureFlagsTest.php',
    'Feature/HomeTest.php',
    'Feature/Catalog',
    'Feature/City',
    'Unit/Domain/Catalog',
    'Feature/Auth',
    'Unit/Domain/Accounts',
);

// Живые проверки сервисов compose: нужен запущенный `docker compose`. Запуск: composer test:docker.
pest()->group('docker')->in('Feature/LocalEnv/LocalServicesTest.php');

/**
 * Запрашивает код входа и возвращает его из перехваченного письма (нужен Mail::fake()).
 */
function requestLoginCode(string $email, string $ip = '203.0.113.10'): string
{
    currentTest()->withServerVariables(['REMOTE_ADDR' => $ip])
        ->postJson('/auth/email/code', ['email' => $email])
        ->assertStatus(202);

    /** @var LoginCodeMail $mail */
    $mail = Mail::queued(LoginCodeMail::class)->last();

    return $mail->code;
}

/**
 * Код из 6 цифр, гарантированно отличный от выданного.
 */
function wrongLoginCode(string $code): string
{
    return str_pad((string) (((int) $code + 1) % 1_000_000), 6, '0', STR_PAD_LEFT);
}

/**
 * Текущий тест как Tests\TestCase — для хелперов вне замыканий Pest.
 */
function currentTest(): TestCase
{
    $test = test();

    if ($test instanceof HigherOrderTapProxy && $test->target instanceof TestCase) {
        return $test->target;
    }

    throw new LogicException('Хелпер вызван вне теста');
}
