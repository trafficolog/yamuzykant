<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Actions;

use App\Domain\Accounts\Data\VerifiedIdentity;
use App\Domain\Accounts\EmailLogin\EmailAddress;
use App\Domain\Accounts\EmailLogin\LoginCodeStore;
use App\Domain\Accounts\EmailLogin\LoginThrottle;
use App\Domain\Accounts\Exceptions\InvalidLoginCode;
use App\Domain\Accounts\Exceptions\TooManyLoginAttempts;

/**
 * Проверяет код. Попытка засчитывается до сравнения: сверх лимита и во время блока
 * код не сравнивается вовсе — даже верный не пускает.
 */
final readonly class VerifyLoginCode
{
    public function __construct(
        private LoginThrottle $throttle,
        private LoginCodeStore $store,
    ) {}

    /**
     * @throws TooManyLoginAttempts
     * @throws InvalidLoginCode
     */
    public function handle(EmailAddress $email, string $code, string $ip): VerifiedIdentity
    {
        $attempt = $this->throttle->hitVerificationAttempt($email, $ip);

        if (! $this->store->matches($email, $code)) {
            // При блоке почты действующий код сгорает: после него нужен новый.
            $this->throttle->failVerification($attempt, fn () => $this->store->forget($email));

            throw new InvalidLoginCode;
        }

        $this->store->forget($email);
        $this->throttle->passVerification($attempt);

        return new VerifiedIdentity($email);
    }
}
