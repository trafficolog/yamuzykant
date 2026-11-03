<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Data;

/**
 * Шаг первого входа: имя, город (необязателен), согласие.
 */
final readonly class RegistrationData
{
    public function __construct(
        public string $name,
        public ?int $cityId,
        public bool $consent,
    ) {}
}
