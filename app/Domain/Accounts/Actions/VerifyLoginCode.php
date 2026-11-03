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
 * Проверяет код. Во время блокировки код не проверяется вовсе — даже верный не пускает.
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
    public function handle(EmailAddress $email, string $code): VerifiedIdentity
    {
        $this->throttle->ensureNotLocked($email);

        if (! $this->store->matches($email, $code)) {
            // При блокировке действующий код сгорает: после неё нужен новый.
            $this->throttle->hitFailedAttempt($email, fn () => $this->store->forget($email));

            throw new InvalidLoginCode;
        }

        $this->store->forget($email);
        $this->throttle->clearFailedAttempts($email);

        return new VerifiedIdentity($email);
    }
}
