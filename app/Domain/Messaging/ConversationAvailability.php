<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\Models\Listing;
use App\Domain\Messaging\Exceptions\ConversationClosed;
use App\Domain\Messaging\Models\Conversation;

/**
 * Можно ли участнику писать в беседу (BR-10). Одно правило для отправки (SendMessage, внутри транзакции с
 * блокировкой объявления) и для экрана сообщений (причина «только чтение» без попытки отправки).
 *
 * - Объявление опубликовано — можно.
 * - Отклонено модератором или снято с причиной «модерация» — закрыто сразу.
 * - Иначе — ещё `messaging.reply_window_days` дней с `unpublished_at`; позже закрыто.
 * - Собеседник удалил аккаунт — закрыто.
 */
final class ConversationAvailability
{
    /** Почему писать нельзя; null — можно. */
    public static function closure(Conversation $conversation, Listing $listing, User $viewer): ?ConversationClosed
    {
        if ($listing->status !== ListingStatus::Published) {
            if (self::removedByModeration($listing)) {
                return ConversationClosed::removedByModeration();
            }
            if (! self::withinReplyWindow($listing)) {
                return ConversationClosed::listingNotPublished();
            }
        }

        if ($conversation->counterpartId($viewer) === null) {
            return ConversationClosed::counterpartDeleted();
        }

        return null;
    }

    /**
     * BR-10: после ухода из published отвечать можно ещё messaging.reply_window_days дней. Момент — unpublished_at
     * (ведёт ListingStateMachine). Без него окно закрыто: updated_at меняется любой записью и открывал бы беседу заново.
     * Окно — ровно N×24 часа: в момент unpublished_at + N дней отвечать уже нельзя.
     */
    private static function withinReplyWindow(Listing $listing): bool
    {
        return $listing->unpublished_at !== null
            && $listing->unpublished_at->copy()->addDays((int) config('messaging.reply_window_days'))->isFuture();
    }

    /** Решение оркестратора по BR-10: отклонено модератором или снято с причиной «модерация» — без окна. */
    private static function removedByModeration(Listing $listing): bool
    {
        return $listing->status === ListingStatus::Rejected
            || $listing->saleRecord?->reason === WithdrawReason::Moderation;
    }
}
