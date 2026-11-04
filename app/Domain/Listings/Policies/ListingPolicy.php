<?php

declare(strict_types=1);

namespace App\Domain\Listings\Policies;

use App\Domain\Accounts\Models\User;
use App\Domain\Accounts\Staff\StaffDirectory;
use App\Domain\Listings\Enums\ListingEvent;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\StateMachines\ListingStateMachine;

/**
 * Права на объявление: гость, владелец, сотрудник (до 5.3.1 — через заглушку StaffDirectory).
 * Действия продавца разрешены, только если машина допускает событие из текущего статуса.
 */
final class ListingPolicy
{
    /** Статусы, в которых владелец меняет содержание объявления. */
    private const EDITABLE = [ListingStatus::Draft, ListingStatus::NeedsChanges, ListingStatus::Published];

    /** Статусы, которые видны гостю по прямой ссылке. */
    private const PUBLIC = [ListingStatus::Published, ListingStatus::Withdrawn, ListingStatus::Expired];

    public function __construct(private readonly StaffDirectory $staff) {}

    /**
     * Опубликованное, снятое и истёкшее видно всем (плашка «Снято с продажи» на лоте — 3.1.5);
     * черновик, проверка, доработка и отклонённое — только владельцу и сотруднику.
     */
    public function view(?User $user, Listing $listing): bool
    {
        return in_array($listing->status, self::PUBLIC, true)
            || $this->owns($user, $listing)
            || ($user !== null && $this->staff->isStaff($user));
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Listing $listing): bool
    {
        return $this->owns($user, $listing) && in_array($listing->status, self::EDITABLE, true);
    }

    public function publish(User $user, Listing $listing): bool
    {
        return $this->ownerMay($user, $listing, ListingEvent::Publish);
    }

    public function resubmit(User $user, Listing $listing): bool
    {
        return $this->ownerMay($user, $listing, ListingEvent::Resubmit);
    }

    public function withdraw(User $user, Listing $listing): bool
    {
        return $this->ownerMay($user, $listing, ListingEvent::Withdraw);
    }

    public function renew(User $user, Listing $listing): bool
    {
        return $this->ownerMay($user, $listing, ListingEvent::Renew);
    }

    public function relist(User $user, Listing $listing): bool
    {
        return $this->ownerMay($user, $listing, ListingEvent::Relist);
    }

    /** Одобрить, вернуть или отклонить — сотрудник, объявление на проверке. */
    public function moderate(User $user, Listing $listing): bool
    {
        return $this->staff->isStaff($user) && $listing->status === ListingStatus::Pending;
    }

    private function owns(?User $user, Listing $listing): bool
    {
        return $user !== null && $user->id === $listing->user_id;
    }

    private function ownerMay(User $user, Listing $listing, ListingEvent $event): bool
    {
        // Флаг на допустимость события продавца не влияет: меняется только цель перехода.
        return $this->owns($user, $listing) && ListingStateMachine::allows($listing->status, $event, true);
    }
}
