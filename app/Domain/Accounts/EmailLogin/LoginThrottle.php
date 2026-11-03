<?php

declare(strict_types=1);

namespace App\Domain\Accounts\EmailLogin;

use App\Domain\Accounts\Exceptions\TooManyLoginAttempts;
use Illuminate\Cache\RateLimiter;
use Illuminate\Contracts\Cache\Factory as CacheFactory;
use Illuminate\Support\Facades\Config;

/**
 * Лимиты входа по коду. Каждая попытка сначала атомарно засчитывается (INCR в Redis),
 * и только потом сравнивается с лимитом: параллельные запросы не могут одновременно
 * «увидеть свободную попытку».
 *
 * - отправка кодов: на адрес и с IP за окно;
 * - неверные коды: по паре почта+IP (блок пары) и общий потолок на почту (блок почты).
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
        $window = Config::integer('login.limits.codes_window');
        $limits = [
            $this->codesEmailKey($email) => Config::integer('login.limits.codes_per_email'),
            $this->codesIpKey($ip) => Config::integer('login.limits.codes_per_ip'),
        ];

        $retryAfter = 0;
        foreach ($limits as $key => $max) {
            // Окно фиксированное (таймер ставится первой попыткой), лишние попытки его не продлевают.
            if ($limiter->hit($key, $window) > $max) {
                $retryAfter = max($retryAfter, $limiter->availableIn($key));
            }
        }

        if ($retryAfter > 0) {
            throw new TooManyLoginAttempts($retryAfter);
        }
    }

    /**
     * Засчитывает попытку проверки кода ДО сравнения. Если пара или почта заблокированы
     * или попытка сверх лимита — исключение, код не сравнивается.
     *
     * @throws TooManyLoginAttempts
     */
    public function hitVerificationAttempt(EmailAddress $email, string $ip): VerificationAttempt
    {
        $limiter = $this->limiter();

        foreach ([$this->emailLockKey($email), $this->pairLockKey($email, $ip)] as $lockKey) {
            if ($limiter->tooManyAttempts($lockKey, 1)) {
                throw new TooManyLoginAttempts($limiter->availableIn($lockKey));
            }
        }

        $pairAttempt = $limiter->hit($this->pairFailuresKey($email, $ip), Config::integer('login.limits.lockout'));
        if ($pairAttempt > Config::integer('login.limits.max_failed_attempts')) {
            throw new TooManyLoginAttempts(Config::integer('login.limits.lockout'));
        }

        $emailAttempt = $limiter->hit($this->emailFailuresKey($email), Config::integer('login.limits.email_failures_window'));
        if ($emailAttempt > Config::integer('login.limits.max_failed_attempts_per_email')) {
            throw new TooManyLoginAttempts(Config::integer('login.limits.email_lockout'));
        }

        return new VerificationAttempt($email, $ip, $pairAttempt, $emailAttempt);
    }

    /**
     * Код неверный. На последней допустимой попытке ставит блок и бросает исключение.
     * Счётчики при этом не обнуляются: запросы в полёте не получают второе окно.
     *
     * @param  callable(): void  $onEmailLock  вызывается при блоке почты (сжечь действующий код)
     *
     * @throws TooManyLoginAttempts
     */
    public function failVerification(VerificationAttempt $attempt, callable $onEmailLock): void
    {
        $limiter = $this->limiter();

        if ($attempt->emailAttempt >= Config::integer('login.limits.max_failed_attempts_per_email')) {
            $lockout = Config::integer('login.limits.email_lockout');
            $limiter->hit($this->emailLockKey($attempt->email), $lockout);
            $onEmailLock();

            throw new TooManyLoginAttempts($lockout);
        }

        if ($attempt->pairAttempt >= Config::integer('login.limits.max_failed_attempts')) {
            // Блок только для пары: код не сжигается, владелец входит им со своего IP.
            $lockout = Config::integer('login.limits.lockout');
            $limiter->hit($this->pairLockKey($attempt->email, $attempt->ip), $lockout);

            throw new TooManyLoginAttempts($lockout);
        }
    }

    /**
     * Код верный: счётчик пары сбрасывается, успешная попытка не считается неверной для почты.
     */
    public function passVerification(VerificationAttempt $attempt): void
    {
        $limiter = $this->limiter();

        $limiter->clear($this->pairFailuresKey($attempt->email, $attempt->ip));
        $limiter->decrement($this->emailFailuresKey($attempt->email), Config::integer('login.limits.email_failures_window'));
    }

    private function limiter(): RateLimiter
    {
        return new RateLimiter($this->cache->store(Config::string('login.code_store')));
    }

    private function codesEmailKey(EmailAddress $email): string
    {
        return 'login:codes:email:'.$email->key();
    }

    private function codesIpKey(string $ip): string
    {
        return 'login:codes:ip:'.$this->ipHash($ip);
    }

    private function pairFailuresKey(EmailAddress $email, string $ip): string
    {
        return 'login:failures:pair:'.$email->key().':'.$this->ipHash($ip);
    }

    private function pairLockKey(EmailAddress $email, string $ip): string
    {
        return 'login:lock:pair:'.$email->key().':'.$this->ipHash($ip);
    }

    private function emailFailuresKey(EmailAddress $email): string
    {
        return 'login:failures:email:'.$email->key();
    }

    private function emailLockKey(EmailAddress $email): string
    {
        return 'login:lock:email:'.$email->key();
    }

    private function ipHash(string $ip): string
    {
        return hash('sha256', $ip);
    }
}
