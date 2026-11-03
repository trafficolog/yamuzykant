<?php

declare(strict_types=1);

namespace App\Domain\Accounts\EmailLogin;

/**
 * Засчитанная (до сравнения кода) попытка проверки: её номер по паре почта+IP и по почте.
 */
final readonly class VerificationAttempt
{
    public function __construct(
        public EmailAddress $email,
        public string $ip,
        public int $pairAttempt,
        public int $emailAttempt,
    ) {}
}
