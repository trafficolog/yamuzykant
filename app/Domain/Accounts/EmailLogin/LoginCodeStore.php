<?php

declare(strict_types=1);

namespace App\Domain\Accounts\EmailLogin;

use Illuminate\Contracts\Cache\Factory as CacheFactory;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Support\Facades\Config;

/**
 * Хранит HMAC кода (не сам код) с TTL. Один адрес — один действующий код: новый заменяет прежний.
 */
final class LoginCodeStore
{
    public function __construct(private readonly CacheFactory $cache) {}

    public function put(EmailAddress $email, string $code): void
    {
        $this->store()->put($this->key($email), $this->hash($email, $code), Config::integer('login.code_ttl'));
    }

    public function matches(EmailAddress $email, string $code): bool
    {
        $stored = $this->store()->get($this->key($email));

        return is_string($stored) && hash_equals($stored, $this->hash($email, $code));
    }

    public function has(EmailAddress $email): bool
    {
        return $this->store()->has($this->key($email));
    }

    public function forget(EmailAddress $email): void
    {
        $this->store()->forget($this->key($email));
    }

    private function store(): Repository
    {
        return $this->cache->store(Config::string('login.code_store'));
    }

    private function key(EmailAddress $email): string
    {
        return 'login:code:'.$email->key();
    }

    private function hash(EmailAddress $email, string $code): string
    {
        return hash_hmac('sha256', $email->value.'|'.$code, Config::string('app.key'));
    }
}
