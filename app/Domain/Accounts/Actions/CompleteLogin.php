<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Actions;

use App\Domain\Accounts\Data\LoginResult;
use App\Domain\Accounts\Data\RegistrationData;
use App\Domain\Accounts\Data\VerifiedIdentity;
use App\Domain\Accounts\EmailLogin\EmailAddress;
use App\Domain\Accounts\Exceptions\ConsentRequired;
use App\Domain\Accounts\Exceptions\RegistrationNotPending;
use App\Domain\Accounts\Models\User;
use Illuminate\Contracts\Auth\Factory as AuthFactory;
use Illuminate\Contracts\Auth\StatefulGuard;
use Illuminate\Contracts\Session\Session;
use Illuminate\Support\Facades\Config;

/**
 * Общее завершение входа для кода на почту (1.1.1) и Яндекс ID (1.1.5):
 * найти пользователя или запомнить «нужна регистрация», согласие, сессия, возврат к действию.
 */
final readonly class CompleteLogin
{
    /** Состояние «нужна регистрация»: подтверждённая личность до согласия. В users ничего не пишется. */
    public const string PENDING_KEY = 'auth.pending_registration';

    /** Версия сессий пользователя на момент входа — для «выйти на всех устройствах». */
    public const string SESSION_VERSION_KEY = 'auth.session_version';

    public function __construct(
        private AuthFactory $auth,
        private Session $session,
    ) {}

    public function handle(VerifiedIdentity $identity): LoginResult
    {
        $user = $this->findUser($identity);

        if ($user === null) {
            $this->session->put(self::PENDING_KEY, [
                'email' => $identity->email->value,
                'yandex_id' => $identity->yandexId,
                'name' => $identity->name,
            ]);

            return LoginResult::registrationRequired($identity->name);
        }

        // Яндекс ID привязывается к аккаунту с той же почтой (SPEC UC-A1), чужой не перезаписывается.
        if ($identity->yandexId !== null && $user->yandex_id === null) {
            $user->yandex_id = $identity->yandexId;
        }

        return $this->login($user);
    }

    /**
     * @throws RegistrationNotPending
     * @throws ConsentRequired
     */
    public function register(RegistrationData $data): LoginResult
    {
        $identity = $this->pendingRegistration() ?? throw new RegistrationNotPending;

        if (! $data->consent) {
            throw new ConsentRequired;
        }

        $user = $this->findUser($identity) ?? User::query()->createOrFirst(
            ['email' => $identity->email->value],
            [
                'yandex_id' => $identity->yandexId,
                'name' => $data->name,
                'city_id' => $data->cityId,
                'consent_version' => Config::string('login.consent_version'),
                'consented_at' => now(),
            ],
        );

        return $this->login($user);
    }

    public function pendingRegistration(): ?VerifiedIdentity
    {
        $pending = $this->session->get(self::PENDING_KEY);

        if (! is_array($pending) || ! is_string($pending['email'] ?? null)) {
            return null;
        }

        return new VerifiedIdentity(
            EmailAddress::from($pending['email']),
            is_string($pending['yandex_id'] ?? null) ? $pending['yandex_id'] : null,
            is_string($pending['name'] ?? null) ? $pending['name'] : null,
        );
    }

    private function findUser(VerifiedIdentity $identity): ?User
    {
        if ($identity->yandexId !== null) {
            $user = User::query()->where('yandex_id', $identity->yandexId)->first();

            if ($user !== null) {
                return $user;
            }
        }

        return User::query()->where('email', $identity->email->value)->first();
    }

    private function login(User $user): LoginResult
    {
        $user->last_login_at = now();
        $user->save();

        // SessionGuard::login() меняет идентификатор сессии (защита от фиксации сессии).
        $this->guard()->login($user);

        $this->session->forget(self::PENDING_KEY);
        $this->session->put(self::SESSION_VERSION_KEY, $user->session_version);

        $intended = $this->session->pull('url.intended');

        return LoginResult::authenticated(is_string($intended) ? $intended : '/');
    }

    private function guard(): StatefulGuard
    {
        $guard = $this->auth->guard('web');
        assert($guard instanceof StatefulGuard);

        return $guard;
    }
}
