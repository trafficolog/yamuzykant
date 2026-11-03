<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Domain\Listings\Enums\ListingEvent;
use App\Domain\Listings\Enums\ListingStatus;

/**
 * Таблица переходов объявления SPEC §6.1 — независимая от реализации копия диаграммы.
 *
 * Ключ — "from:event", значение — [цель при включённом premoderation, цель при выключенном].
 * Решение OWNER (карточка 2.1.1): без флага переходы «в pending» ведут сразу в published.
 * Любая пара (from, event), которой нет в таблице, — IllegalTransition при обоих значениях флага.
 */
final class ListingTransitions
{
    public const TABLE = [
        'draft:publish' => ['pending', 'published'],
        'pending:approve' => ['published', 'published'],
        'pending:return' => ['needs_changes', 'needs_changes'],
        'pending:reject' => ['rejected', 'rejected'],
        'needs_changes:resubmit' => ['pending', 'published'],
        'published:substantial_edit' => ['pending', 'published'],
        'published:minor_edit' => ['published', 'published'],
        'published:price_drop' => ['published', 'published'],
        'published:withdraw' => ['withdrawn', 'withdrawn'],
        'published:expire' => ['expired', 'expired'],
        'expired:renew' => ['pending', 'published'],
        'withdrawn:relist' => ['pending', 'published'],
    ];

    /**
     * Все пары (from, event) × оба значения флага: 7 × 12 × 2 = 168 случаев.
     * Последний элемент — ожидаемый статус или null, если переход недопустим.
     *
     * @return array<string, array{ListingStatus, ListingEvent, bool, ListingStatus|null}>
     */
    public static function cases(): array
    {
        $cases = [];
        foreach (ListingStatus::cases() as $from) {
            foreach (ListingEvent::cases() as $event) {
                foreach ([true, false] as $premoderation) {
                    $expected = self::TABLE[$from->value.':'.$event->value] ?? null;
                    $target = $expected === null ? null : ListingStatus::from($expected[$premoderation ? 0 : 1]);
                    $label = sprintf('%s + %s, premoderation %s', $from->value, $event->value, $premoderation ? 'on' : 'off');
                    $cases[$label] = [$from, $event, $premoderation, $target];
                }
            }
        }

        return $cases;
    }
}
