<?php

declare(strict_types=1);

namespace App\Domain\Notifications;

use App\Domain\Accounts\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;

/**
 * «В сети» для писем о сообщениях (4.4.1): последний запрос пользователя не старше окна `notifications.online_minutes`.
 * Хранится только метка в кеше с TTL — в БД и журнал ничего не пишется.
 */
final class Presence
{
    private const REFRESH_SECONDS = 60;

    /** Не чаще раза в минуту: в кеше метка со временем записи, свежую не перезаписываем. */
    public static function touch(User $user): void
    {
        $now = now()->getTimestamp();
        $seen = Cache::get(self::key($user));

        if (is_int($seen) && $now - $seen < self::REFRESH_SECONDS) {
            return;
        }

        Cache::put(self::key($user), $now, now()->addMinutes(Config::integer('notifications.online_minutes')));
    }

    public static function isOnline(User $user): bool
    {
        return Cache::has(self::key($user));
    }

    private static function key(User $user): string
    {
        return 'presence:user:'.$user->id;
    }
}
