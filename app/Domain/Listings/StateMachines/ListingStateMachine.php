<?php

declare(strict_types=1);

namespace App\Domain\Listings\StateMachines;

use App\Domain\Listings\Enums\ListingEvent;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\Events\ListingApproved;
use App\Domain\Listings\Events\ListingExpired;
use App\Domain\Listings\Events\ListingMinorEdited;
use App\Domain\Listings\Events\ListingPriceDropped;
use App\Domain\Listings\Events\ListingPublished;
use App\Domain\Listings\Events\ListingRejected;
use App\Domain\Listings\Events\ListingRelisted;
use App\Domain\Listings\Events\ListingRenewed;
use App\Domain\Listings\Events\ListingResubmitted;
use App\Domain\Listings\Events\ListingReturned;
use App\Domain\Listings\Events\ListingSubstantiallyEdited;
use App\Domain\Listings\Events\ListingTransitioned;
use App\Domain\Listings\Events\ListingWithdrawn;
use App\Domain\Listings\Exceptions\IllegalTransition;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\SaleRecord;
use App\Domain\Listings\Rules\SubstantialEdit;
use App\Domain\Moderation\Enums\ModerationVerdict;
use App\Domain\Moderation\Models\ModerationDecision;
use App\Support\Flags\FeatureFlag;
use Closure;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Laravel\Pennant\Feature;

/**
 * Жизненный цикл объявления (SPEC §6.1) — единственное место, где меняется статус.
 *
 * Флаг Pennant `premoderation` (решение OWNER, карточка 2.1.1): выключен — переходы «на проверку»
 * (publish, resubmit, substantial_edit, renew, relist) ведут сразу в published; включён — в pending.
 * Решения модератора из pending доступны при любом значении флага: в pending могли остаться объявления.
 * Снять с продажи можно из published, pending, needs_changes и expired (решение OWNER 04.11.2026).
 *
 * Каждый переход идёт в транзакции по статусу из БД под блокировкой строки и отправляет своё событие
 * (подкласс ListingTransitioned) после фиксации.
 */
final class ListingStateMachine
{
    /** Цель «на проверку»: pending при включённой премодерации, иначе published. */
    private const REVIEW = 'review';

    /** @var array<string, array<string, string>> from → event → цель */
    private const TABLE = [
        'draft' => ['publish' => self::REVIEW],
        'pending' => [
            'approve' => 'published',
            'return' => 'needs_changes',
            'reject' => 'rejected',
            'withdraw' => 'withdrawn',
        ],
        'needs_changes' => ['resubmit' => self::REVIEW, 'withdraw' => 'withdrawn'],
        'published' => [
            'substantial_edit' => self::REVIEW,
            'minor_edit' => 'published',
            'price_drop' => 'published',
            'withdraw' => 'withdrawn',
            'expire' => 'expired',
        ],
        'expired' => ['renew' => self::REVIEW, 'withdraw' => 'withdrawn'],
        'withdrawn' => ['relist' => self::REVIEW],
        'rejected' => [],
    ];

    /** Статусы, из которых при снятии можно указать итоговую цену. */
    private const SOLD_FROM = [ListingStatus::Published, ListingStatus::Expired];

    /** @var array<string, class-string<ListingTransitioned>> */
    private const EVENTS = [
        'publish' => ListingPublished::class,
        'approve' => ListingApproved::class,
        'return' => ListingReturned::class,
        'reject' => ListingRejected::class,
        'resubmit' => ListingResubmitted::class,
        'substantial_edit' => ListingSubstantiallyEdited::class,
        'minor_edit' => ListingMinorEdited::class,
        'price_drop' => ListingPriceDropped::class,
        'withdraw' => ListingWithdrawn::class,
        'expire' => ListingExpired::class,
        'renew' => ListingRenewed::class,
        'relist' => ListingRelisted::class,
    ];

    /**
     * Статус после события.
     *
     * @throws IllegalTransition события нет среди стрелок из статуса $from
     */
    public static function target(ListingStatus $from, ListingEvent $event, bool $premoderation): ListingStatus
    {
        $target = self::TABLE[$from->value][$event->value] ?? throw new IllegalTransition($from, $event);

        if ($target === self::REVIEW) {
            return $premoderation ? ListingStatus::Pending : ListingStatus::Published;
        }

        return ListingStatus::from($target);
    }

    public static function allows(ListingStatus $from, ListingEvent $event, bool $premoderation): bool
    {
        try {
            self::target($from, $event, $premoderation);

            return true;
        } catch (IllegalTransition) {
            return false;
        }
    }

    /** Включена ли премодерация (флаг Pennant, глобальный scope). */
    public static function premoderation(): bool
    {
        return Feature::for(null)->active(FeatureFlag::Premoderation->value);
    }

    public function publish(Listing $listing): Listing
    {
        return $this->transition($listing, fn (): ListingEvent => ListingEvent::Publish);
    }

    public function approve(Listing $listing, ?int $staffId = null): Listing
    {
        return $this->transition(
            $listing,
            fn (): ListingEvent => ListingEvent::Approve,
            fn (Listing $fresh) => $this->decide($fresh, ModerationVerdict::Approved, null, $staffId),
        );
    }

    /** Вернуть на доработку; причина показывается продавцу дословно. */
    public function returnForChanges(Listing $listing, string $reason, ?int $staffId = null): Listing
    {
        $reason = self::requireReason($reason);

        return $this->transition(
            $listing,
            fn (): ListingEvent => ListingEvent::Return,
            fn (Listing $fresh) => $this->decide($fresh, ModerationVerdict::Returned, $reason, $staffId),
        );
    }

    public function reject(Listing $listing, string $reason, ?int $staffId = null): Listing
    {
        $reason = self::requireReason($reason);

        return $this->transition(
            $listing,
            fn (): ListingEvent => ListingEvent::Reject,
            fn (Listing $fresh) => $this->decide($fresh, ModerationVerdict::Rejected, $reason, $staffId),
        );
    }

    public function resubmit(Listing $listing): Listing
    {
        return $this->transition($listing, fn (): ListingEvent => ListingEvent::Resubmit);
    }

    /**
     * Правка опубликованного объявления. Вид правки (substantial_edit, price_drop, minor_edit)
     * определяет SubstantialEdit. Принимаются только поля Listing::EDITABLE: владелец, статус,
     * даты и id — отказ целиком, ничего не сохраняется.
     *
     * @param  array<string, mixed>  $attributes
     *
     * @throws InvalidArgumentException поле вне белого списка или отрицательная цена
     */
    public function edit(Listing $listing, array $attributes, bool $photosChanged = false): Listing
    {
        $foreign = array_diff(array_keys($attributes), Listing::EDITABLE);
        if ($foreign !== []) {
            throw new InvalidArgumentException('Эти поля объявления не меняются правкой: '.implode(', ', $foreign).'.');
        }
        if (isset($attributes['price']) && (! is_int($attributes['price']) || $attributes['price'] < 0)) {
            throw new InvalidArgumentException('Цена — целое число рублей, не меньше нуля.');
        }

        return $this->transition($listing, function (Listing $fresh) use ($attributes, $photosChanged): ListingEvent {
            $oldPrice = $fresh->price;
            $fresh->fill($attributes);
            $changed = array_keys($fresh->getDirty());
            if ($photosChanged) {
                $changed[] = SubstantialEdit::PHOTOS;
            }

            return SubstantialEdit::eventFor($changed, $oldPrice, $fresh->price);
        });
    }

    /**
     * Снять с продажи (UC-L4). Итоговая цена — только для «продал» из published или expired
     * (решение OWNER 04.11.2026), необязательна, больше нуля.
     */
    public function withdraw(Listing $listing, WithdrawReason $reason, ?int $finalPrice = null): Listing
    {
        if ($finalPrice !== null && (! $reason->isSale() || $finalPrice <= 0)) {
            throw new InvalidArgumentException('Итоговая цена указывается только при продаже и больше нуля.');
        }

        return $this->transition(
            $listing,
            function (Listing $fresh) use ($reason, $finalPrice): ListingEvent {
                // Сначала — допустим ли переход вообще (IllegalTransition важнее ошибки аргументов).
                self::target($fresh->status, ListingEvent::Withdraw, false);

                // Статус проверяется по заблокированной копии: объявление на проверке ещё не показывалось,
                // продать его на ЯМузыканте и указать итоговую цену нельзя (решение оркестратора по UC-L4, OWNER — на G1).
                $wasShown = in_array($fresh->status, self::SOLD_FROM, true);
                if (! $wasShown && $reason === WithdrawReason::SoldHere) {
                    throw new InvalidArgumentException('«Продал на ЯМузыканте» — только для опубликованного объявления.');
                }
                if (! $wasShown && $finalPrice !== null) {
                    throw new InvalidArgumentException('Итоговая цена указывается только при снятии опубликованного объявления.');
                }

                return ListingEvent::Withdraw;
            },
            fn (Listing $fresh) => SaleRecord::query()->updateOrCreate(
                ['listing_id' => $fresh->id],
                [
                    'reason' => $reason,
                    'final_price' => $finalPrice,
                    'sold_at' => $reason->isSale() ? now()->toDateString() : null,
                ],
            ),
        );
    }

    public function expire(Listing $listing): Listing
    {
        return $this->transition($listing, fn (): ListingEvent => ListingEvent::Expire);
    }

    public function renew(Listing $listing): Listing
    {
        return $this->transition($listing, fn (): ListingEvent => ListingEvent::Renew);
    }

    /** Вернуть в продажу: прежняя запись о продаже больше не верна. */
    public function relist(Listing $listing): Listing
    {
        return $this->transition(
            $listing,
            fn (): ListingEvent => ListingEvent::Relist,
            fn (Listing $fresh) => SaleRecord::query()->whereKey($fresh->id)->delete(),
        );
    }

    /**
     * @param  Closure(Listing): ListingEvent  $decide  событие по свежей заблокированной копии
     * @param  (Closure(Listing): mixed)|null  $after  запись побочных данных в той же транзакции
     */
    private function transition(Listing $listing, Closure $decide, ?Closure $after = null): Listing
    {
        $premoderation = self::premoderation();

        try {
            [$fresh, $from, $event] = DB::transaction(function () use ($listing, $decide, $after, $premoderation): array {
                $fresh = Listing::query()->whereKey($listing->getKey())->lockForUpdate()->firstOrFail();
                $from = $fresh->status;
                $event = $decide($fresh);
                $to = self::target($from, $event, $premoderation);

                $fresh->status = $to;
                if ($to === ListingStatus::Published && $from !== ListingStatus::Published) {
                    $fresh->published_at = now();
                } elseif ($to === ListingStatus::Pending) {
                    $fresh->published_at = null;
                }
                Listing::withStatusChange(fn (): bool => $fresh->save());

                if ($after !== null) {
                    $after($fresh);
                }

                return [$fresh, $from, $event];
            });
        } catch (IllegalTransition $e) {
            // Вызывающий видит фактический статус из БД, а не устаревший экземпляр.
            $listing->refresh();

            throw $e;
        }

        $listing->setRawAttributes($fresh->getAttributes(), true);
        $listing->unsetRelations();

        $class = self::EVENTS[$event->value];
        event(new $class($listing, $from, $listing->status, $event));

        return $listing;
    }

    private function decide(Listing $listing, ModerationVerdict $verdict, ?string $reason, ?int $staffId): void
    {
        ModerationDecision::query()->create([
            'listing_id' => $listing->id,
            'verdict' => $verdict,
            'reason' => $reason,
            'staff_id' => $staffId,
        ]);
    }

    private static function requireReason(string $reason): string
    {
        $reason = trim($reason);
        if ($reason === '') {
            throw new InvalidArgumentException('Причина решения модерации обязательна.');
        }

        return $reason;
    }
}
