<?php

declare(strict_types=1);

namespace App\Domain\Accounts\EmailLogin;

use App\Domain\Accounts\Exceptions\TooManyLoginAttempts;
use Illuminate\Cache\RateLimiter;
use Illuminate\Contracts\Cache\Factory as CacheFactory;
use Illuminate\Support\Facades\Config;

/**
 * Лимиты входа по коду: отправка кодов на адрес и с IP, блокировка после неверных кодов.
 */
final class LoginThrottle
{
    public function __construct(private readonly CacheFactory $cache) {}

    /**
     * @throws TooManyLoginAttempts
     */
    public function hitCodeRequest(EmailAddress $email, string $ip): void
    {
        $limiter = $this->limiter();
        $limits = [
            $this->emailKey($email) => Config::integer('login.limits.codes_per_email'),
            $this->ipKey($ip) => Config::integer('login.limits.codes_per_ip'),
        ];

        $retryAfter = 0;
        foreach ($limits as $key => $max) {
            if ($limiter->tooManyAttempts($key, $max)) {
                $retryAfter = max($retryAfter, $limiter->availableIn($key));
            }
        }

        if ($retryAfter > 0) {
            throw new TooManyLoginAttempts($retryAfter);
        }

        foreach (array_keys($limits) as $key) {
            $limiter->hit($key, Config::integer('login.limits.codes_window'));
        }
    }

    /**
     * @throws TooManyLoginAttempts
     */
    public function ensureNotLocked(EmailAddress $email): void
    {
        $limiter = $this->limiter();
        $key = $this->lockKey($email);

        if ($limiter->tooManyAttempts($key, 1)) {
            throw new TooManyLoginAttempts($limiter->availableIn($key));
        }
    }

    /**
     * Засчитывает неверный код. На последней допустимой попытке ставит блокировку и бросает исключение.
     *
     * @param  callable(): void  $onLock
     *
     * @throws TooManyLoginAttempts
     */
    public function hitFailedAttempt(EmailAddress $email, callable $onLock): void
    {
        $limiter = $this->limiter();
        $lockout = Config::integer('login.limits.lockout');

        $failures = $limiter->hit($this->failuresKey($email), $lockout);

        if ($failures >= Config::integer('login.limits.max_failed_attempts')) {
            $limiter->clear($this->failuresKey($email));
            $limiter->hit($this->lockKey($email), $lockout);
            $onLock();

            throw new TooManyLoginAttempts($lockout);
        }
    }

    public function clearFailedAttempts(EmailAddress $email): void
    {
        $this->limiter()->clear($this->failuresKey($email));
    }

    private function limiter(): RateLimiter
    {
        return new RateLimiter($this->cache->store(Config::string('login.code_store')));
    }

    private function emailKey(EmailAddress $email): string
    {
        return 'login:codes:email:'.$email->key();
    }

    private function ipKey(string $ip): string
    {
        return 'login:codes:ip:'.hash('sha256', $ip);
    }

    private function failuresKey(EmailAddress $email): string
    {
        return 'login:failures:'.$email->key();
    }

    private function lockKey(EmailAddress $email): string
    {
        return 'login:lock:'.$email->key();
    }
}
