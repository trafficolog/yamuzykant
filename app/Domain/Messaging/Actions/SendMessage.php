<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Actions;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\Models\Listing;
use App\Domain\Messaging\Enums\MessageKind;
use App\Domain\Messaging\Events\MessageSent;
use App\Domain\Messaging\Events\UnreadCountChanged;
use App\Domain\Messaging\Exceptions\ConversationClosed;
use App\Domain\Messaging\Exceptions\MessageNotSaved;
use App\Domain\Messaging\MessageBody;
use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Models\Message;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Отправить текстовое сообщение в беседу. Писать можно, только пока объявление опубликовано и собеседник
 * не удалил аккаунт. События (сообщение в канал беседы, счётчик получателю) уходят после commit.
 * Текст сообщения не пишется в журнал.
 */
final class SendMessage
{
    /**
     * @throws AuthorizationException $sender не участник беседы (Policy проверяет раньше — это второй слой)
     * @throws ConversationClosed
     * @throws InvalidArgumentException пустой или слишком длинный текст
     */
    public function handle(User $sender, Conversation $conversation, #[\SensitiveParameter] string $text): Message
    {
        if (! $conversation->isParticipant($sender)) {
            throw new AuthorizationException;
        }

        $body = MessageBody::from($text);

        return DB::transaction(function () use ($sender, $conversation, $body): Message {
            $listing = Listing::query()->whereKey($conversation->listing_id)->sharedLock()->firstOrFail();
            if ($listing->status !== ListingStatus::Published) {
                if ($this->removedByModeration($listing)) {
                    throw ConversationClosed::removedByModeration();
                }
                if (! $this->withinReplyWindow($listing)) {
                    throw ConversationClosed::listingNotPublished();
                }
            }

            $recipientId = $conversation->counterpartId($sender);
            if ($recipientId === null) {
                throw ConversationClosed::counterpartDeleted();
            }

            $message = new Message;
            $message->conversation_id = $conversation->id;
            $message->sender_id = $sender->id;
            $message->kind = MessageKind::Text;
            $message->body = $body->value;

            try {
                $message->save();
            } catch (QueryException $e) {
                // Исключение БД несёт SQL с текстом сообщения: наружу — только SQLSTATE, без previous.
                throw new MessageNotSaved((string) $e->getCode(), (string) $conversation->id);
            }

            $conversation->last_message_at = $message->created_at;
            $conversation->save();

            MessageSent::dispatch($message);
            UnreadCountChanged::dispatch($recipientId);

            return $message;
        });
    }

    /**
     * BR-10: после ухода из published отвечать можно ещё messaging.reply_window_days дней. Момент — unpublished_at
     * (ведёт ListingStateMachine). Без него окно закрыто: updated_at меняется любой записью и открывал бы беседу заново.
     * Окно — ровно N×24 часа: в момент unpublished_at + N дней отвечать уже нельзя.
     */
    private function withinReplyWindow(Listing $listing): bool
    {
        return $listing->unpublished_at !== null
            && $listing->unpublished_at->copy()->addDays((int) config('messaging.reply_window_days'))->isFuture();
    }

    /** Решение оркестратора по BR-10: отклонено модератором или снято с причиной «модерация» — без окна. */
    private function removedByModeration(Listing $listing): bool
    {
        return $listing->status === ListingStatus::Rejected
            || $listing->saleRecord?->reason === WithdrawReason::Moderation;
    }
}
