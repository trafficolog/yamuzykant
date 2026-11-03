<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Models\City;
use Illuminate\Support\Facades\Mail;

beforeEach(function () {
    Mail::fake();
    config(['login.code_fake' => null, 'login.consent_version' => 'test-2026-11']);
});

function verifyNewEmail(string $email): void
{
    $code = requestLoginCode($email);

    test()->postJson('/auth/email/verify', ['email' => $email, 'code' => $code])
        ->assertJsonPath('status', 'registration_required');
}

it('первый вход создаёт пользователя с согласием и пишет версию документа', function () {
    $this->freezeSecond();
    $city = City::factory()->create(['name' => 'Москва', 'region' => 'Москва']);
    verifyNewEmail('Boris@Example.com');

    $this->postJson('/auth/register', ['name' => '  Борис ', 'city_id' => $city->id, 'consent' => true])
        ->assertOk()
        ->assertExactJson(['status' => 'authenticated', 'redirect' => '/']);

    $user = User::query()->sole();
    expect($user->email)->toBe('boris@example.com')
        ->and($user->name)->toBe('Борис')
        ->and($user->city_id)->toBe($city->id)
        ->and($user->consent_version)->toBe('test-2026-11')
        ->and($user->consented_at?->equalTo(now()))->toBeTrue()
        ->and($user->last_login_at?->equalTo(now()))->toBeTrue()
        ->and($user->yandex_id)->toBeNull();
    $this->assertAuthenticatedAs($user);
    expect(session()->has('auth.pending_registration'))->toBeFalse();
});

it('город необязателен', function () {
    verifyNewEmail('boris@example.com');

    $this->postJson('/auth/register', ['name' => 'Борис', 'consent' => true])->assertOk();

    expect(User::query()->sole()->city_id)->toBeNull();
});

it('без согласия пользователь не создаётся', function (array $payload) {
    verifyNewEmail('boris@example.com');

    $this->postJson('/auth/register', ['name' => 'Борис', ...$payload])
        ->assertStatus(422)
        ->assertJsonPath('errors.consent.0', 'Подтвердите согласие с правилами и политикой обработки персональных данных');

    expect(User::query()->count())->toBe(0);
    $this->assertGuest();
    expect(session('auth.pending_registration.email'))->toBe('boris@example.com');
})->with([
    'нет поля' => [[]],
    'false' => [['consent' => false]],
]);

it('без имени пользователь не создаётся', function () {
    verifyNewEmail('boris@example.com');

    $this->postJson('/auth/register', ['name' => '   ', 'consent' => true])
        ->assertStatus(422)
        ->assertJsonPath('errors.name.0', 'Укажите имя');

    expect(User::query()->count())->toBe(0);
});

it('несуществующий город отклоняется', function () {
    verifyNewEmail('boris@example.com');

    $this->postJson('/auth/register', ['name' => 'Борис', 'city_id' => 999_999, 'consent' => true])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['city_id']);

    expect(User::query()->count())->toBe(0);
});

it('без подтверждённой почты регистрация невозможна', function () {
    $this->postJson('/auth/register', ['name' => 'Борис', 'consent' => true])
        ->assertStatus(409)
        ->assertJsonPath('message', 'Подтвердите почту: запросите код ещё раз');

    expect(User::query()->count())->toBe(0);
});

it('если аккаунт с этой почтой появился, пока шла регистрация, входит в него без дубля', function () {
    verifyNewEmail('boris@example.com');
    $existing = User::factory()->create(['email' => 'boris@example.com', 'name' => 'Борис Старый']);

    $this->postJson('/auth/register', ['name' => 'Борис', 'consent' => true])->assertOk();

    expect(User::query()->count())->toBe(1);
    $this->assertAuthenticatedAs($existing);
});
