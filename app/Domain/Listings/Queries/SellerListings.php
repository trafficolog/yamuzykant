<?php

declare(strict_types=1);

namespace App\Domain\Listings\Queries;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\Models\Listing;
use Illuminate\Database\Eloquent\Builder;

/**
 * Объявления продавца для его публичной страницы (UC-V2). «В продаже» — только опубликованные (SPEC §6.1: остальное
 * видят владелец и сотрудники). «Продано» — снятые с причиной-продажей (WithdrawReason::isSale); «передумал» и снятие
 * модерацией не показываем. Свежие первыми.
 */
final class SellerListings
{
    public const PER_PAGE = 24;

    /** @return Builder<Listing> */
    public function onSale(User $seller): Builder
    {
        return Listing::query()
            ->where('user_id', $seller->id)
            ->where('status', ListingStatus::Published->value)
            ->orderByDesc('published_at')
            ->orderBy('id');
    }

    /** @return Builder<Listing> */
    public function sold(User $seller): Builder
    {
        $reasons = array_map(
            fn (WithdrawReason $reason): string => $reason->value,
            array_filter(WithdrawReason::cases(), fn (WithdrawReason $reason): bool => $reason->isSale()),
        );

        return Listing::query()
            ->where('user_id', $seller->id)
            ->where('status', ListingStatus::Withdrawn->value)
            ->whereHas('saleRecord', fn (Builder $record) => $record->whereIn('reason', $reasons))
            ->orderByDesc('unpublished_at')
            ->orderBy('id');
    }
}
