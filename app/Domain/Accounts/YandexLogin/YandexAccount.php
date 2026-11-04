<?php

declare(strict_types=1);

namespace App\Domain\Accounts\YandexLogin;

use App\Domain\Accounts\EmailLogin\EmailAddress;
use App\Domain\Accounts\Exceptions\YandexLoginFailed;
use Laravel\Socialite\AbstractUser;
use Laravel\Socialite\Contracts\User as SocialiteUser;

/**
 * Данные из Яндекс ID, нужные для входа: id, подтверждённая почта (default_email), имя.
 * Токены сюда не попадают и нигде не хранятся.
 */
final readonly class YandexAccount
{
    private const int NAME_MAX_LENGTH = 255;

    public function __construct(
        public string $id,
        public ?EmailAddress $email,
        public ?string $name,
    ) {}

    /**
     * @throws YandexLoginFailed
     */
    public static function fromSocialite(SocialiteUser $user): self
    {
        // id у Яндекса — строка из цифр; приходит и числом, поэтому приводится к строке.
        $id = trim((string) $user->getId());
        if ($id === '') {
            throw new YandexLoginFailed('profile without id');
        }

        $raw = $user instanceof AbstractUser ? $user->getRaw() : [];

        return new self($id, self::email($user->getEmail()), self::name([
            $raw['first_name'] ?? null,
            $user->getName(),
            $raw['real_name'] ?? null,
            $raw['display_name'] ?? null,
        ]));
    }

    /**
     * Почта из Яндекс ID считается подтверждённой (ARCHITECTURE §7). Не адрес — как будто почты нет.
     */
    private static function email(mixed $email): ?EmailAddress
    {
        if (! is_string($email) || filter_var(trim($email), FILTER_VALIDATE_EMAIL) === false) {
            return null;
        }

        return EmailAddress::from($email);
    }

    /**
     * Имя для шага регистрации: first_name, иначе полное имя, иначе отображаемое.
     *
     * @param  list<mixed>  $candidates
     */
    private static function name(array $candidates): ?string
    {
        foreach ($candidates as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return mb_substr(trim($candidate), 0, self::NAME_MAX_LENGTH);
            }
        }

        return null;
    }
}
