<?php

declare(strict_types=1);

use App\Domain\Accounts\EmailLogin\EmailAddress;
use App\Domain\Accounts\Mail\LoginCodeMail;
use App\Domain\Accounts\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Str;

/*
 * Интеграция с настоящим Redis (LOGIN_CODE_STORE=redis): хранилище кодов, лимиты и блокировки.
 * В CI Redis есть в сервисах job php; локально без Redis тесты пропускаются (в CI — падают).
 * Изоляция: у каждого теста свой префикс ключей кэша, поэтому состояние лимитов не переживает тест.
 */

beforeEach(function () {
    try {
        Redis::connection('cache')->ping();
    } catch (Throwable $e) {
        if (getenv('CI') !== false) {
            throw $e;
        }
        $this->markTestSkipped('Redis недоступен: '.$e->getMessage());
    }

    config([
        'login.code_store' => 'redis',
        'login.code_fake' => null,
        'cache.prefix' => 'test-login-'.Str::uuid()->toString().':',
    ]);
    Cache::forgetDriver('redis');
    Mail::fake();
});

it('Redis: код хранится хэшем, верный код входит, повторно не действует', function () {
    User::factory()->create(['email' => 'anna@example.com']);
    $code = requestLoginCode('anna@example.com');

    $stored = Cache::store('redis')->get('login:code:'.EmailAddress::from('anna@example.com')->key());
    expect($stored)->toBeString()->toMatch('/^[0-9a-f]{64}$/')
        ->and($stored)->not->toContain($code);

    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])
        ->assertOk()
        ->assertJsonPath('status', 'authenticated');
    auth()->logout();

    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])->assertStatus(422);
});

it('Redis: 6-й код за час на адрес → 429', function () {
    foreach (range(1, 5) as $i) {
        $this->withServerVariables(['REMOTE_ADDR' => "203.0.113.{$i}"])
            ->postJson('/auth/email/code', ['email' => 'anna@example.com'])
            ->assertStatus(202);
    }

    $this->postJson('/auth/email/code', ['email' => 'anna@example.com'])
        ->assertStatus(429)
        ->assertJsonPath('message', 'Слишком много попыток. Повторите через 60 мин');
    Mail::assertQueued(LoginCodeMail::class, 5);
});

it('Redis: 5 неверных кодов с одного IP → блок пары даже с верным кодом, другой IP входит', function () {
    User::factory()->create(['email' => 'anna@example.com']);
    $code = requestLoginCode('anna@example.com', '203.0.113.10');

    foreach (range(1, 4) as $ignored) {
        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.66'])
            ->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => wrongLoginCode($code)])
            ->assertStatus(422);
    }
    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.66'])
        ->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => wrongLoginCode($code)])
        ->assertStatus(429)
        ->assertHeader('Retry-After', '900');
    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.66'])
        ->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])
        ->assertStatus(429);

    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.10'])
        ->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])
        ->assertOk();
});

it('Redis: состояние лимитов не переживает тест (свой префикс)', function () {
    // Тот же адрес и IP, что в тесте выше: при общем состоянии здесь был бы 429.
    foreach (range(1, 5) as $ignored) {
        $this->postJson('/auth/email/code', ['email' => 'anna@example.com'])->assertStatus(202);
    }
});
