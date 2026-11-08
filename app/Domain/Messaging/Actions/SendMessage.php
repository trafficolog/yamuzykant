<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Actions;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Models\Listing;
use App\Domain\Messaging\ConversationAvailability;
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
 * Отправить текстовое сообщение в беседу. Писать можно, пока объявление опубликовано (или идёт окно ответов
 * BR-10) и собеседник не удалил аккаунт — правило в ConversationAvailability. События (сообщение в канал беседы,
 * счётчик получателю) уходят после commit. Текст сообщения не пишется в журнал.
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
            $closure = ConversationAvailability::closure($conversation, $listing, $sender);
            if ($closure !== null) {
                throw $closure;
            }

            // Собеседник уже проверен в closure(); здесь — только сужение типа для получателя события.
            $recipientId = $conversation->counterpartId($sender) ?? throw ConversationClosed::counterpartDeleted();

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
}
