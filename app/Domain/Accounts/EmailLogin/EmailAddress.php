<?php

declare(strict_types=1);

namespace App\Domain\Accounts\EmailLogin;

use Illuminate\Support\Facades\Config;
use Stringable;

/**
 * Почта — идентификатор аккаунта: всегда без пробелов по краям и в нижнем регистре.
 */
final readonly class EmailAddress implements Stringable
{
    private function __construct(public string $value) {}

    public static function from(string $email): self
    {
        return new self(mb_strtolower(trim($email)));
    }

    /**
     * Ключ для хранилища кодов и лимитов: HMAC почты, чтобы в Redis и логах не было ПДн.
     */
    public function key(): string
    {
        return hash_hmac('sha256', $this->value, Config::string('app.key'));
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
