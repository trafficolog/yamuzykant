<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use Illuminate\Support\Facades\Auth;

// 1.1.6: выход — POST с CSRF; после выхода сессия и токен сменяются, старый токен недействителен.

/**
 * Включает проверку CSRF: Laravel пропускает её только в окружении `testing`, поэтому окружение
 * переопределяется штатным detectEnvironment приложения, а не записью в контейнер.
 */
function withCsrfChecks(): void
{
    app()->detectEnvironment(fn (): string => 'local');
}

function signedInForLogout(): User
{
    $user = User::factory()->create();
    Auth::guard('web')->login($user);

    return $user;
}

it('выход без CSRF-токена — 419, сессия остаётся', function () {
    $user = signedInForLogout();
    withCsrfChecks();

    $this->postJson('/auth/logout')->assertStatus(419);

    $this->assertAuthenticatedAs($user);
});

it('выход с токеном сессии: сессия завершена, id и токен сменились, старый токен — 419', function () {
    signedInForLogout();
    withCsrfChecks();
    $oldToken = csrf_token();
    $oldId = session()->getId();

    $this->postJson('/auth/logout', [], ['X-CSRF-TOKEN' => $oldToken])->assertOk();

    $this->assertGuest();
    expect(session()->getId())->not->toBe($oldId)
        ->and(session()->token())->not->toBe($oldToken);

    $this->postJson('/auth/logout', [], ['X-CSRF-TOKEN' => $oldToken])->assertStatus(419);
});

it('выход — только POST', function () {
    signedInForLogout();

    $this->get('/auth/logout')->assertStatus(405);
});
