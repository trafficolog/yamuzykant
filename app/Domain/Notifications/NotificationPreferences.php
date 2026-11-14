<?php

declare(strict_types=1);

namespace App\Domain\Notifications;

use App\Domain\Accounts\Models\User;
use App\Domain\Notifications\Enums\NotificationKind;

/**
 * Настройки писем пользователя (`users.notification_prefs`). Единственное место, где читают и пишут их:
 * отправка писем (4.4.1) спрашивает `allows()`, профиль (1.1.3) читает `for()` и пишет `update()`.
 * Не заданное или испорченное значение — значение по умолчанию вида; неизвестные ключи игнорируются.
 */
final class NotificationPreferences
{
    /** Разрешено ли отправить пользователю письмо этого вида. */
    public static function allows(User $user, NotificationKind $kind): bool
    {
        return self::for($user)[$kind->value];
    }

    /**
     * Состояние всех видов: ключ вида → включён.
     *
     * @return array<string, bool>
     */
    public static function for(User $user): array
    {
        $stored = $user->notification_prefs ?? [];
        $result = [];

        foreach (NotificationKind::cases() as $kind) {
            $value = $stored[$kind->value] ?? null;
            $result[$kind->value] = is_bool($value) ? $value : $kind->enabledByDefault();
        }

        return $result;
    }

    /**
     * Сохраняет значения известных видов; остальные ключи отбрасываются.
     *
     * @param  array<string, mixed>  $changes
     */
    public static function update(User $user, array $changes): void
    {
        $prefs = self::for($user);

        foreach (NotificationKind::cases() as $kind) {
            if (array_key_exists($kind->value, $changes)) {
                $prefs[$kind->value] = filter_var($changes[$kind->value], FILTER_VALIDATE_BOOLEAN);
            }
        }

        $user->forceFill(['notification_prefs' => $prefs])->save();
    }
}
