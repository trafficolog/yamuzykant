<?php

declare(strict_types=1);

namespace App\Support\YandexId;

use SocialiteProviders\Yandex\Provider;

/**
 * Подменный Яндекс ID для CI и e2e (YANDEX_OAUTH_FAKE): без сети и секретов отдаёт тестового
 * пользователя. state и PKCE работают как у настоящего провайдера — меняется только «Яндекс».
 * Включается ТОЛЬКО в окружениях YandexOAuth::FAKE_ENVIRONMENTS.
 */
final class FakeYandexProvider extends Provider
{
    /** Ответ login.yandex.ru/info тестового пользователя. */
    public const array USER = [
        'id' => '1130000000000001',
        'login' => 'ymuzykant-test',
        'first_name' => 'Анна',
        'real_name' => 'Анна Тестова',
        'display_name' => 'ymuzykant-test',
        'default_email' => 'yandex-test@example.com',
    ];

    public const string CODE = 'fake-yandex-code';

    /**
     * Вместо oauth.yandex.ru — сразу наш callback (путь из настроенного адреса возврата), как после «Разрешить».
     */
    protected function getAuthUrl($state): string
    {
        $path = parse_url($this->redirectUrl, PHP_URL_PATH);

        return (is_string($path) && $path !== '' ? $path : '/auth/yandex/callback')
            .'?'.http_build_query(['code' => self::CODE, 'state' => $state]);
    }

    /**
     * @param  string  $code
     * @return array<string, mixed>
     */
    public function getAccessTokenResponse($code): array
    {
        // Как настоящий обмен: code_verifier забирается из сессии (одноразовый).
        $this->getTokenFields($code);

        return ['access_token' => 'fake-access-token', 'token_type' => 'bearer', 'expires_in' => 3600];
    }

    /**
     * @param  string  $token
     * @return array<string, string>
     */
    protected function getUserByToken($token): array
    {
        return self::USER;
    }
}
