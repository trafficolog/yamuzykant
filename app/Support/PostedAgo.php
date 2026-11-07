<?php

declare(strict_types=1);

namespace App\Support;

use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/** Давность публикации на карточке: «2 ч назад», «вчера», «3 окт». Отображение — Europe/Moscow. */
final class PostedAgo
{
    private const TZ = 'Europe/Moscow';

    private const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

    public static function format(CarbonInterface $at, ?CarbonInterface $now = null): string
    {
        $now = Carbon::instance($now ?? Carbon::now());
        $ago = max(0, $now->getTimestamp() - $at->getTimestamp());

        if ($ago < 60) {
            return 'только что';
        }
        if ($ago < 3600) {
            return intdiv($ago, 60).' мин назад';
        }
        if ($ago < 86_400) {
            return intdiv($ago, 3600).' ч назад';
        }

        $local = Carbon::instance($at)->setTimezone(self::TZ);
        $today = $now->copy()->setTimezone(self::TZ)->startOfDay();
        $days = (int) $local->copy()->startOfDay()->diffInDays($today);

        if ($days <= 1) {
            return 'вчера';
        }
        if ($days < 7) {
            return $days.' '.self::plural($days, 'день', 'дня', 'дней').' назад';
        }

        $date = $local->day.' '.self::MONTHS[$local->month - 1];

        return $local->year === $today->year ? $date : $date.' '.$local->year;
    }

    private static function plural(int $n, string $one, string $few, string $many): string
    {
        $mod10 = $n % 10;
        $mod100 = $n % 100;

        return match (true) {
            $mod10 === 1 && $mod100 !== 11 => $one,
            $mod10 >= 2 && $mod10 <= 4 && ($mod100 < 10 || $mod100 >= 20) => $few,
            default => $many,
        };
    }
}
