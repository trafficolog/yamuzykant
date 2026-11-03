<?php

declare(strict_types=1);

namespace App\Domain\Accounts\EmailLogin;

use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Config;

final class LoginCodeGenerator
{
    /**
     * Закрытый список окружений, где действует LOGIN_CODE_FAKE. Не выносится в конфиг намеренно:
     * фиксированный код в local, stage или production — это открытый вход в любой аккаунт.
     */
    public const array FAKE_ENVIRONMENTS = ['testing', 'e2e'];

    public function generate(): string
    {
        return $this->fakeCode()
            ?? str_pad((string) random_int(0, 999_999), 6, '0', STR_PAD_LEFT);
    }

    /**
     * Фиксированный код из LOGIN_CODE_FAKE или null, если он не действует в этом окружении.
     */
    public function fakeCode(): ?string
    {
        if (! App::environment(self::FAKE_ENVIRONMENTS)) {
            return null;
        }

        $fake = Config::get('login.code_fake');

        return is_string($fake) && preg_match('/^\d{6}$/', $fake) === 1 ? $fake : null;
    }
}
