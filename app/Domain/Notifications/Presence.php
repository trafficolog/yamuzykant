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
    public static function touch(User $user): void
    {
        Cache::put(self::key($user), true, now()->addMinutes(Config::integer('notifications.online_minutes')));
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
