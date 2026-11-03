<?php

declare(strict_types=1);

use App\Domain\Accounts\Actions\CompleteLogin;
use App\Domain\Accounts\Data\LoginStatus;
use App\Domain\Accounts\Data\RegistrationData;
use App\Domain\Accounts\Data\VerifiedIdentity;
use App\Domain\Accounts\EmailLogin\EmailAddress;
use App\Domain\Accounts\Exceptions\ConsentRequired;
use App\Domain\Accounts\Exceptions\RegistrationNotPending;
use App\Domain\Accounts\Models\User;
use Illuminate\Support\Facades\Auth;

beforeEach(function () {
    config(['login.consent_version' => 'test-2026-11']);
});

it('находит пользователя по почте и входит', function () {
    $user = User::factory()->create(['email' => 'anna@example.com']);

    $result = app(CompleteLogin::class)->handle(new VerifiedIdentity(EmailAddress::from('ANNA@example.com')));

    expect($result->status)->toBe(LoginStatus::Authenticated)
        ->and($result->redirect)->toBe('/')
        ->and(Auth::id())->toBe($user->id)
        ->and(session('auth.session_version'))->toBe(0);
});

it('находит пользователя по yandex_id, даже если почта в Яндексе сменилась', function () {
    $user = User::factory()->create(['email' => 'anna@example.com', 'yandex_id' => '1000001']);

    $result = app(CompleteLogin::class)->handle(new VerifiedIdentity(EmailAddress::from('new@yandex.ru'), yandexId: '1000001'));

    expect($result->status)->toBe(LoginStatus::Authenticated)
        ->and(Auth::id())->toBe($user->id)
        ->and($user->fresh()?->email)->toBe('anna@example.com');
});

it('привязывает Яндекс ID к аккаунту с той же почтой', function () {
    $user = User::factory()->create(['email' => 'anna@example.com', 'yandex_id' => null]);

    app(CompleteLogin::class)->handle(new VerifiedIdentity(EmailAddress::from('anna@example.com'), yandexId: '1000001'));

    expect($user->fresh()?->yandex_id)->toBe('1000001');
});

it('не перезаписывает чужой yandex_id у аккаунта с той же почтой', function () {
    $user = User::factory()->create(['email' => 'anna@example.com', 'yandex_id' => '1000001']);

    app(CompleteLogin::class)->handle(new VerifiedIdentity(EmailAddress::from('anna@example.com'), yandexId: '2000002'));

    expect($user->fresh()?->yandex_id)->toBe('1000001');
});

it('новый пользователь: ждёт регистрации, предлагает имя, ничего не пишет в users', function () {
    $result = app(CompleteLogin::class)->handle(
        new VerifiedIdentity(EmailAddress::from('boris@yandex.ru'), yandexId: '3000003', name: 'Борис'),
    );

    expect($result->status)->toBe(LoginStatus::RegistrationRequired)
        ->and($result->suggestedName)->toBe('Борис')
        ->and(User::query()->count())->toBe(0)
        ->and(Auth::check())->toBeFalse()
        ->and(app(CompleteLogin::class)->pendingRegistration()?->email->value)->toBe('boris@yandex.ru');
});

it('регистрация создаёт пользователя с yandex_id из ожидающей регистрации', function () {
    app(CompleteLogin::class)->handle(new VerifiedIdentity(EmailAddress::from('boris@yandex.ru'), yandexId: '3000003'));

    $result = app(CompleteLogin::class)->register(new RegistrationData(name: 'Борис', cityId: null, consent: true));

    $user = User::query()->sole();
    expect($result->status)->toBe(LoginStatus::Authenticated)
        ->and($user->yandex_id)->toBe('3000003')
        ->and($user->consent_version)->toBe('test-2026-11')
        ->and(app(CompleteLogin::class)->pendingRegistration())->toBeNull();
});

it('регистрация без согласия бросает исключение и не пишет в users', function () {
    app(CompleteLogin::class)->handle(new VerifiedIdentity(EmailAddress::from('boris@example.com')));

    expect(fn () => app(CompleteLogin::class)->register(new RegistrationData(name: 'Борис', cityId: null, consent: false)))
        ->toThrow(ConsentRequired::class);
    expect(User::query()->count())->toBe(0);
});

it('регистрация без ожидающей регистрации бросает исключение', function () {
    expect(fn () => app(CompleteLogin::class)->register(new RegistrationData(name: 'Борис', cityId: null, consent: true)))
        ->toThrow(RegistrationNotPending::class);
});
