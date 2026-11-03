<?php

declare(strict_types=1);

namespace App\Domain\Accounts\YandexLogin;

use Illuminate\Contracts\Session\Session;
use Illuminate\Support\Facades\Config;

/**
 * Яндекс ID без почты ждёт шага «Введите почту»: в сессии только id и имя, срок — TTL кода входа.
 * Обычный вход по почте это состояние сбрасывает, чтобы чужой Яндекс ID не привязался к аккаунту.
 */
final readonly class PendingYandexLink
{
    public const string KEY = 'auth.pending_yandex';

    public function __construct(private Session $session) {}

    public function put(YandexAccount $account): void
    {
        $this->session->put(self::KEY, [
            'yandex_id' => $account->id,
            'name' => $account->name,
            'expires_at' => now()->addSeconds(Config::integer('login.code_ttl'))->getTimestamp(),
        ]);
    }

    public function has(): bool
    {
        return $this->get() !== null;
    }

    /**
     * Действующий ожидающий Яндекс ID или null (нет, повреждён или истёк).
     */
    public function get(): ?YandexAccount
    {
        $pending = $this->session->get(self::KEY);

        if (! is_array($pending) || ! is_string($pending['yandex_id'] ?? null) || ! is_int($pending['expires_at'] ?? null)) {
            return null;
        }

        if ($pending['expires_at'] <= now()->getTimestamp()) {
            $this->forget();

            return null;
        }

        return new YandexAccount(
            $pending['yandex_id'],
            null,
            is_string($pending['name'] ?? null) ? $pending['name'] : null,
        );
    }

    public function forget(): void
    {
        $this->session->forget(self::KEY);
    }
}
