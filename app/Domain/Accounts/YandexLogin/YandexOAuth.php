<?php

declare(strict_types=1);

namespace App\Domain\Accounts\YandexLogin;

use App\Domain\Accounts\Exceptions\InvalidYandexState;
use App\Domain\Accounts\Exceptions\YandexLoginFailed;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Laravel\Socialite\Contracts\Provider as ProviderContract;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\AbstractProvider;
use Laravel\Socialite\Two\InvalidStateException;
use SocialiteProviders\Yandex\Provider;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Throwable;

/**
 * OAuth Яндекс ID (ARCHITECTURE §7): state и PKCE (S256), адрес возврата — только из конфига,
 * токены Яндекса не хранятся — из ответа берутся только id, почта и имя.
 */
final readonly class YandexOAuth
{
    public const string DRIVER = 'yandex';

    /** @var list<string> */
    public const array SCOPES = ['login:email', 'login:info'];

    /**
     * Закрытый список окружений, где действует YANDEX_OAUTH_FAKE. Не выносится в конфиг намеренно:
     * подменный провайдер в local, stage или production — это вход без Яндекса в чужой аккаунт.
     */
    public const array FAKE_ENVIRONMENTS = ['testing', 'e2e'];

    public function __construct(private Request $request) {}

    public static function fakeEnabled(): bool
    {
        return App::environment(self::FAKE_ENVIRONMENTS) && Config::boolean('services.yandex.fake', false);
    }

    /**
     * Провайдер Socialite для драйвера `yandex` (регистрируется в AppServiceProvider).
     */
    public static function makeProvider(Request $request): AbstractProvider
    {
        $guzzle = Config::get('services.yandex.guzzle', []);
        $class = self::fakeEnabled() ? FakeYandexProvider::class : Provider::class;

        $provider = new $class(
            $request,
            Config::string('services.yandex.client_id', ''),
            Config::string('services.yandex.client_secret', ''),
            Config::string('services.yandex.redirect'),
            is_array($guzzle) ? $guzzle : [],
        );

        return $provider->scopes(self::SCOPES)->enablePKCE();
    }

    /**
     * Переход на страницу Яндекса: state и code_verifier запоминаются в сессии.
     */
    public function redirect(): RedirectResponse
    {
        return $this->provider()->redirect();
    }

    /**
     * Данные пользователя по возврату от Яндекса.
     *
     * @throws InvalidYandexState
     * @throws YandexLoginFailed
     */
    public function account(): YandexAccount
    {
        if ($this->request->query->has('error')) {
            // Отказ тоже проверяет state: страницу «вход отменён» нельзя вызвать с чужого сайта.
            if (! $this->consumeState()) {
                throw new InvalidYandexState;
            }

            throw new YandexLoginFailed('denied');
        }

        try {
            $user = $this->provider()->user();
        } catch (InvalidStateException) {
            $this->request->session()->forget('code_verifier');

            throw new InvalidYandexState;
        } catch (Throwable $e) {
            // Без сообщения исключения: в нём может быть ответ Яндекса. Код и токены в лог не попадают.
            Log::warning('auth.yandex.failed', ['exception' => $e::class]);

            throw new YandexLoginFailed($e::class);
        }

        return YandexAccount::fromSocialite($user);
    }

    private function provider(): ProviderContract
    {
        $provider = Socialite::driver(self::DRIVER);

        // Драйвер кэшируется менеджером Socialite: сессия и параметры — только из текущего запроса.
        if ($provider instanceof AbstractProvider) {
            $provider->setRequest($this->request);
        }

        return $provider;
    }

    /**
     * Забирает state и code_verifier из сессии (одноразово) и сверяет state с ответом Яндекса.
     */
    private function consumeState(): bool
    {
        $session = $this->request->session();
        $expected = $session->pull('state');
        $session->forget('code_verifier');

        return is_string($expected) && $expected !== ''
            && hash_equals($expected, (string) $this->request->query('state'));
    }
}
