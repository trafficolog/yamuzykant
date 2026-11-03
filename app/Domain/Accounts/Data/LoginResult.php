<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Data;

final readonly class LoginResult
{
    private function __construct(
        public LoginStatus $status,
        public ?string $redirect = null,
        public ?string $suggestedName = null,
    ) {}

    public static function authenticated(string $redirect): self
    {
        return new self(LoginStatus::Authenticated, redirect: $redirect);
    }

    public static function registrationRequired(?string $suggestedName): self
    {
        return new self(LoginStatus::RegistrationRequired, suggestedName: $suggestedName);
    }

    /**
     * Ответ клиенту — явный список полей, без ПДн и кода.
     *
     * @return array{status: string, redirect?: string|null, name?: string|null}
     */
    public function toArray(): array
    {
        return match ($this->status) {
            LoginStatus::Authenticated => ['status' => $this->status->value, 'redirect' => $this->redirect],
            LoginStatus::RegistrationRequired => ['status' => $this->status->value, 'name' => $this->suggestedName],
        };
    }
}
