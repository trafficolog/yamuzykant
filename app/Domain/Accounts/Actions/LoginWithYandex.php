<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Actions;

use App\Domain\Accounts\Data\LoginResult;
use App\Domain\Accounts\Data\VerifiedIdentity;
use App\Domain\Accounts\EmailLogin\EmailAddress;
use App\Domain\Accounts\Exceptions\YandexLoginNotPending;
use App\Domain\Accounts\YandexLogin\PendingYandexLink;
use App\Domain\Accounts\YandexLogin\YandexAccount;
use Illuminate\Contracts\Session\Session;

/**
 * Вход через Яндекс ID (SPEC UC-A1) поверх CompleteLogin: найден yandex_id → вход; иначе аккаунт
 * с той же почтой → привязка и вход; иначе «нужна регистрация» с именем из Яндекса.
 * Лимиты неверных кодов сюда не относятся: кода нет, почту подтвердил Яндекс.
 */
final readonly class LoginWithYandex
{
    public function __construct(
        private CompleteLogin $completeLogin,
        private PendingYandexLink $pending,
        private Session $session,
    ) {}

    public function handle(YandexAccount $account): LoginResult
    {
        if ($account->email === null) {
            // Новый id сессии на промежуточном шаге — защита от фиксации сессии.
            $this->session->migrate(true);
            $this->pending->put($account);

            return LoginResult::emailRequired();
        }

        $this->pending->forget();

        return $this->completeLogin->handle(new VerifiedIdentity($account->email, $account->id, $account->name));
    }

    /**
     * Шаг «Введите почту» начат: без ожидающего Яндекс ID код не отправляется и не проверяется.
     *
     * @throws YandexLoginNotPending
     */
    public function ensurePending(EmailAddress $email): void
    {
        if (! $this->pending->has()) {
            throw new YandexLoginNotPending;
        }

        $this->completeLogin->startAttempt($email);
    }

    /**
     * Почта подтверждена кодом (1.1.1): Яндекс ID привязывается к аккаунту с этой почтой
     * (свой yandex_id у аккаунта не перезаписывается) или уходит в регистрацию.
     *
     * @throws YandexLoginNotPending
     */
    public function completeWithEmail(VerifiedIdentity $verified): LoginResult
    {
        $account = $this->pending->get() ?? throw new YandexLoginNotPending;
        $this->pending->forget();

        return $this->completeLogin->handle(new VerifiedIdentity($verified->email, $account->id, $account->name));
    }

    /**
     * Обычный вход по почте: ожидающий Яндекс ID больше не действует.
     */
    public function abandon(): void
    {
        $this->pending->forget();
    }
}
