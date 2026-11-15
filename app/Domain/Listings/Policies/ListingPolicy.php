<?php

declare(strict_types=1);

namespace App\Domain\Listings\Policies;

use App\Domain\Accounts\Models\User;
use App\Domain\Accounts\Staff\StaffDirectory;
use App\Domain\Listings\Enums\ListingEvent;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use Illuminate\Auth\Access\Response;

/**
 * Права на объявление: гость, владелец, сотрудник (до 5.3.1 — через заглушку StaffDirectory).
 * Действия продавца разрешены, только если машина допускает событие из текущего статуса.
 */
final class ListingPolicy
{
    /** Статусы, в которых владелец меняет содержание объявления. */
    private const EDITABLE = [ListingStatus::Draft, ListingStatus::NeedsChanges, ListingStatus::Published];

    public function __construct(private readonly StaffDirectory $staff) {}

    /**
     * Опубликованное видно всем. Любое другое (черновик, проверка, доработка, отклонённое, снятое, истёкшее) —
     * только владельцу и сотруднику; остальным контроллеры отвечают 404 (решение OWNER 07.11.2026, SPEC §6.1).
     */
    public function view(?User $user, Listing $listing): bool
    {
        return $listing->status === ListingStatus::Published
            || $this->owns($user, $listing)
            || ($user !== null && $this->staff->isStaff($user));
    }

    /** В избранное добавляют только опубликованное (UC-S5); остальным — 404, как у отсутствующего (SPEC §6.1). */
    public function favorite(User $user, Listing $listing): Response
    {
        return $listing->status === ListingStatus::Published ? Response::allow() : Response::denyAsNotFound();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Listing $listing): bool
    {
        return $this->owns($user, $listing) && in_array($listing->status, self::EDITABLE, true);
    }

    /** Изменить опубликованное объявление (форма «Изменить», окно «Снизить цену»): машина правит только published. */
    public function edit(User $user, Listing $listing): Response|bool
    {
        return $this->ownerOnly($user, $listing) ?? $listing->status === ListingStatus::Published;
    }

    public function publish(User $user, Listing $listing): Response|bool
    {
        return $this->ownerMay($user, $listing, ListingEvent::Publish);
    }

    /** Экран результата публикации («Опубликовано» / «Отправлено на проверку»): владелец, после публикации; остальным — 404. */
    public function viewResult(User $user, Listing $listing): Response
    {
        return $this->owns($user, $listing) && in_array($listing->status, [ListingStatus::Published, ListingStatus::Pending], true)
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function resubmit(User $user, Listing $listing): Response|bool
    {
        return $this->ownerMay($user, $listing, ListingEvent::Resubmit);
    }

    public function withdraw(User $user, Listing $listing): Response|bool
    {
        return $this->ownerMay($user, $listing, ListingEvent::Withdraw);
    }

    public function renew(User $user, Listing $listing): Response|bool
    {
        return $this->ownerMay($user, $listing, ListingEvent::Renew);
    }

    public function relist(User $user, Listing $listing): Response|bool
    {
        return $this->ownerMay($user, $listing, ListingEvent::Relist);
    }

    /** Одобрить, вернуть или отклонить — сотрудник, объявление на проверке. */
    public function moderate(User $user, Listing $listing): bool
    {
        return $this->staff->isStaff($user) && $listing->status === ListingStatus::Pending;
    }

    /**
     * Фото, которые видят только владелец и сотрудник: фото серийного номера всегда (UC-L1 — полный номер
     * не публичен, AGENTS.md §4) и любые фото объявления не в published (решение OWNER 07.11.2026, SPEC §6.1).
     */
    public function viewRestrictedPhotos(?User $user, Listing $listing): bool
    {
        return $this->owns($user, $listing) || ($user !== null && $this->staff->isStaff($user));
    }

    private function owns(?User $user, Listing $listing): bool
    {
        return $user !== null && $user->id === $listing->user_id;
    }

    private function ownerMay(User $user, Listing $listing, ListingEvent $event): Response|bool
    {
        // Флаг на допустимость события продавца не влияет: меняется только цель перехода.
        return $this->ownerOnly($user, $listing) ?? ListingStateMachine::allows($listing->status, $event, true);
    }

    /** Чужому объявление «не существует» (404, как у отсутствующего); владельцу — null: решает статус. */
    private function ownerOnly(User $user, Listing $listing): ?Response
    {
        return $this->owns($user, $listing) ? null : Response::denyAsNotFound();
    }
}
