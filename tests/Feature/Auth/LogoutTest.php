<?php

declare(strict_types=1);

use App\Domain\Accounts\Actions\CompleteLogin;
use App\Domain\Accounts\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;

beforeEach(function () {
    Mail::fake();
    config(['login.code_fake' => null]);
});

function loginByCode(string $email): void
{
    $code = requestLoginCode($email);

    currentTest()->postJson('/auth/email/verify', ['email' => $email, 'code' => $code])
        ->assertJsonPath('status', 'authenticated');
}

it('выход завершает текущую сессию', function () {
    User::factory()->create(['email' => 'anna@example.com']);
    loginByCode('anna@example.com');

    $this->postJson('/auth/logout')
        ->assertOk()
        ->assertExactJson(['status' => 'logged_out', 'redirect' => '/']);

    $this->assertGuest();
});

it('«выйти на всех устройствах» завершает и текущую, и другие сессии', function () {
    $user = User::factory()->create(['email' => 'anna@example.com']);
    loginByCode('anna@example.com');

    $this->postJson('/auth/logout-everywhere')
        ->assertOk()
        ->assertExactJson(['status' => 'logged_out', 'redirect' => '/']);

    $this->assertGuest();
    expect($user->fresh()?->session_version)->toBe(1);
});

it('сессия другого устройства перестаёт действовать после «выйти на всех устройствах»', function () {
    $user = User::factory()->create(['email' => 'anna@example.com']);
    loginByCode('anna@example.com');

    // Другое устройство нажало «выйти на всех устройствах».
    $user->forceFill(['session_version' => $user->session_version + 1])->save();
    Auth::forgetGuards();

    $this->postJson('/auth/logout')->assertUnauthorized();
    $this->assertGuest();
});

it('сессия без смены версии продолжает действовать', function () {
    $user = User::factory()->create(['email' => 'anna@example.com']);
    loginByCode('anna@example.com');
    Auth::forgetGuards();

    $this->get('/')->assertOk();
    $this->assertAuthenticatedAs($user);
});

it('сессия вошедшего пользователя без версии считается устаревшей', function () {
    $user = User::factory()->create(['email' => 'anna@example.com']);
    loginByCode('anna@example.com');

    session()->forget(CompleteLogin::SESSION_VERSION_KEY);
    Auth::forgetGuards();

    $this->postJson('/auth/logout')->assertUnauthorized();
    $this->assertGuest();
    expect($user->fresh()?->session_version)->toBe(0);
});

it('версия сессии ставится при любом входе через guard web (событие Login)', function () {
    $user = User::factory()->create();
    $user->forceFill(['session_version' => 3])->save();

    Auth::guard('web')->login($user);

    expect(session(CompleteLogin::SESSION_VERSION_KEY))->toBe(3);
});

it('выход недоступен гостю', function (string $uri) {
    $this->postJson($uri)->assertUnauthorized();
})->with(['/auth/logout', '/auth/logout-everywhere']);
