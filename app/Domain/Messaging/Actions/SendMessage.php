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
use App\Domain\Messaging\Models\MessageFlag;
use App\Domain\Messaging\Spam\SpamDetector;
use App\Domain\Messaging\Spam\SpamSignal;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Отправить текстовое сообщение в беседу. Писать можно, только пока объявление опубликовано и собеседник
 * не удалил аккаунт. События (сообщение в канал беседы, счётчик получателю) уходят после commit.
 * Текст сообщения не пишется в журнал.
 *
 * Идемпотентность (ревью PR #128): клиент присылает client_id, уникальный в беседе для автора. Повтор с тем же
 * ключом («Повторить» после потерянного ответа) возвращает сохранённое сообщение (`wasRecentlyCreated === false`)
 * и ничего не рассылает. Подозрительное по признакам SpamDetector сообщение доставляется с плашкой и попадает
 * в очередь модерации (4.1.3).
 */
final class SendMessage
{
    public function __construct(private readonly SpamDetector $spam) {}

    /**
     * @throws AuthorizationException $sender не участник беседы (Policy проверяет раньше — это второй слой)
     * @throws ConversationClosed
     * @throws InvalidArgumentException пустой или слишком длинный текст
     */
    public function handle(User $sender, Conversation $conversation, #[\SensitiveParameter] string $text, ?string $clientId = null): Message
    {
        if (! $conversation->isParticipant($sender)) {
            throw new AuthorizationException;
        }

        $body = MessageBody::from($text);

        if ($clientId !== null && ($existing = $this->findByClientId($sender, $conversation, $clientId)) !== null) {
            return $existing;
        }

        return DB::transaction(function () use ($sender, $conversation, $body, $clientId): Message {
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

            $signals = [];

            $message = new Message;
            $message->conversation_id = $conversation->id;
            $message->sender_id = $sender->id;
            $message->kind = MessageKind::Text;
            $message->body = $body->value;
            $message->client_id = $clientId;
            $message->body_hash = SpamDetector::hash($body->value);

            try {
                // Запрос признаков (хеш текста в условии) тоже в try: исключение БД несёт SQL с параметрами.
                $signals = $this->spam->detect($sender, $conversation, $body->value);
                $message->suspicious = $signals !== [];

                // Точка сохранения: в PostgreSQL ошибка уникальности иначе обрывает всю транзакцию.
                DB::transaction(fn (): bool => $message->save());
            } catch (UniqueConstraintViolationException $e) {
                // Параллельный запрос с тем же client_id успел раньше: его сообщение и есть результат.
                if ($clientId !== null && ($existing = $this->findByClientId($sender, $conversation, $clientId)) !== null) {
                    return $existing;
                }

                throw new MessageNotSaved((string) $e->getCode(), (string) $conversation->id);
            } catch (QueryException $e) {
                // Исключение БД несёт SQL с текстом сообщения: наружу — только SQLSTATE, без previous.
                throw new MessageNotSaved((string) $e->getCode(), (string) $conversation->id);
            }

            if ($signals !== []) {
                // Очередь модерации: только коды признаков, без текста.
                $flag = new MessageFlag;
                $flag->message_id = $message->id;
                $flag->signals = array_map(static fn (SpamSignal $signal): string => $signal->value, $signals);
                $flag->save();
            }

            $conversation->last_message_at = $message->created_at;
            $conversation->save();

            MessageSent::dispatch($message);
            UnreadCountChanged::dispatch($recipientId);

            return $message;
        });
    }

    private function findByClientId(User $sender, Conversation $conversation, string $clientId): ?Message
    {
        return Message::query()
            ->where('conversation_id', $conversation->id)
            ->where('sender_id', $sender->id)
            ->where('client_id', $clientId)
            ->first();
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
