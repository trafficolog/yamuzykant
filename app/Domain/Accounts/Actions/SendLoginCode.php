<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Actions;

use App\Domain\Accounts\EmailLogin\EmailAddress;
use App\Domain\Accounts\EmailLogin\LoginCodeGenerator;
use App\Domain\Accounts\EmailLogin\LoginCodeStore;
use App\Domain\Accounts\EmailLogin\LoginThrottle;
use App\Domain\Accounts\Exceptions\TooManyLoginAttempts;
use App\Domain\Accounts\Mail\LoginCodeMail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Отправляет код входа. Не смотрит, есть ли аккаунт: ответ и действие одинаковы для любой почты,
 * перебором нельзя узнать, кто зарегистрирован.
 */
final readonly class SendLoginCode
{
    public function __construct(
        private LoginThrottle $throttle,
        private LoginCodeGenerator $generator,
        private LoginCodeStore $store,
    ) {}

    /**
     * @throws TooManyLoginAttempts
     */
    public function handle(EmailAddress $email, string $ip): void
    {
        $this->throttle->hitCodeRequest($email, $ip);

        $code = $this->generator->generate();
        $this->store->put($email, $code);

        Mail::to($email->value)->queue(new LoginCodeMail($code));

        // Ни кода, ни почты в логе — только ключ-HMAC для разбора инцидентов.
        Log::info('auth.login_code.sent', ['email_key' => substr($email->key(), 0, 16)]);
    }
}
