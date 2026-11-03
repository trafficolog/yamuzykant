<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Data;

use App\Domain\Accounts\EmailLogin\EmailAddress;

/**
 * Подтверждённая личность: почта проверена кодом (1.1.1) или пришла из Яндекс ID (1.1.5).
 */
final readonly class VerifiedIdentity
{
    public function __construct(
        public EmailAddress $email,
        public ?string $yandexId = null,
        public ?string $name = null,
    ) {}
}
