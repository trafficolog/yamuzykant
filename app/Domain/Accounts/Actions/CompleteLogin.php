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

    /** Версия сессий пользователя на момент входа — для «выйти на всех устройствах» (RememberSessionVersion). */
    public const string SESSION_VERSION_KEY = 'auth.session_version';

    public function __construct(
        private AuthFactory $auth,
        private Session $session,
    ) {}

    public function handle(VerifiedIdentity $identity): LoginResult
    {
        $user = $this->findUser($identity);

        if ($user === null) {
            // Новый id сессии на шаге регистрации — защита от фиксации сессии.
            $this->session->migrate(true);
            $this->session->put(self::PENDING_KEY, [
                'email' => $identity->email->value,
                'yandex_id' => $identity->yandexId,
                'name' => $identity->name,
                'expires_at' => now()->addSeconds(Config::integer('login.code_ttl'))->getTimestamp(),
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
     * Новая попытка входа: «нужна регистрация» для другой почты больше не действует
     * (общий компьютер: чужая подтверждённая почта не должна дожить до регистрации).
     */
    public function startAttempt(EmailAddress $email): void
    {
        $pending = $this->pendingRegistration();

        if ($pending !== null && $pending->email->value !== $email->value) {
            $this->session->forget(self::PENDING_KEY);
        }
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

    /**
     * Действующее состояние «нужна регистрация» или null (нет, повреждено или истекло — срок = TTL кода).
     */
    public function pendingRegistration(): ?VerifiedIdentity
    {
        $pending = $this->session->get(self::PENDING_KEY);

        if (! is_array($pending) || ! is_string($pending['email'] ?? null) || ! is_int($pending['expires_at'] ?? null)) {
            return null;
        }

        if ($pending['expires_at'] <= now()->getTimestamp()) {
            $this->session->forget(self::PENDING_KEY);

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

        // SessionGuard::login() меняет id сессии (защита от фиксации), событие Login ставит версию сессий.
        $this->guard()->login($user);

        $this->session->forget(self::PENDING_KEY);

        return LoginResult::authenticated($this->safeRedirect($this->session->pull('url.intended')));
    }

    /**
     * Адрес возврата — только относительный путь внутри приложения. Абсолютный URL допускается
     * лишь со схемой http(s) и хостом из APP_URL и сводится к пути; всё остальное — главная.
     */
    private function safeRedirect(mixed $url): string
    {
        if (! is_string($url) || $url === '' || preg_match('/[\x00-\x1F\x7F\\\\]/', $url) === 1) {
            return '/';
        }

        $parts = parse_url($url);
        if ($parts === false) {
            return '/';
        }

        if (isset($parts['scheme']) || isset($parts['host'])) {
            $appHost = parse_url(Config::string('app.url'), PHP_URL_HOST);
            $scheme = strtolower($parts['scheme'] ?? '');

            if (! in_array($scheme, ['http', 'https'], true) || ($parts['host'] ?? null) !== $appHost) {
                return '/';
            }
        }

        $path = $parts['path'] ?? '/';
        if (! str_starts_with($path, '/') || str_starts_with($path, '//')) {
            return '/';
        }

        return isset($parts['query']) ? $path.'?'.$parts['query'] : $path;
    }

    private function guard(): StatefulGuard
    {
        $guard = $this->auth->guard('web');
        assert($guard instanceof StatefulGuard);

        return $guard;
    }
}
