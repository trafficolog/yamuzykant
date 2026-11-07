<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Actions;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Messaging\Exceptions\CannotMessageYourself;
use App\Domain\Messaging\Exceptions\ConversationClosed;
use App\Domain\Messaging\Exceptions\ListingNotAvailable;
use App\Domain\Messaging\MessageBody;
use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Models\Message;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * «Написать продавцу» (UC-D1): первое сообщение покупателя создаёт беседу по объявлению, повторное —
 * продолжает ту же. Только по опубликованному объявлению и не по своему.
 *
 * Пустых бесед нет: беседа появляется вместе с первым сообщением, продавец не видит «чатов без текста».
 */
final class StartConversation
{
    public function __construct(private readonly SendMessage $send) {}

    /**
     * @throws ListingNotAvailable объявление не в published
     * @throws CannotMessageYourself
     * @throws ConversationClosed
     * @throws InvalidArgumentException пустой или слишком длинный текст
     */
    public function handle(User $buyer, Listing $listing, string $text): Message
    {
        if ($listing->status !== ListingStatus::Published) {
            throw new ListingNotAvailable;
        }

        if ($listing->user_id === $buyer->id) {
            throw new CannotMessageYourself;
        }

        // Пустой текст отклоняется до создания беседы.
        MessageBody::from($text);

        return DB::transaction(fn (): Message => $this->send->handle($buyer, $this->conversation($buyer, $listing), $text));
    }

    private function conversation(User $buyer, Listing $listing): Conversation
    {
        $existing = $this->find($buyer, $listing);
        if ($existing !== null) {
            return $existing;
        }

        $conversation = new Conversation;
        $conversation->listing_id = $listing->id;
        $conversation->buyer_id = $buyer->id;
        $conversation->seller_id = $listing->user_id;

        try {
            // Точка сохранения: в PostgreSQL ошибка уникальности иначе обрывает всю транзакцию.
            DB::transaction(fn (): bool => $conversation->save());
        } catch (UniqueConstraintViolationException) {
            // Параллельный первый запрос того же покупателя успел создать беседу.
            return $this->find($buyer, $listing) ?? throw new \LogicException('Беседа не найдена после конфликта.');
        }

        return $conversation;
    }

    private function find(User $buyer, Listing $listing): ?Conversation
    {
        return Conversation::query()
            ->where('listing_id', $listing->id)
            ->where('buyer_id', $buyer->id)
            ->first();
    }
}
