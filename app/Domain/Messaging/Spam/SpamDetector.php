<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Spam;

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\MessageBody;
use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Models\Message;
use App\Domain\Moderation\AutoChecks\Contacts\ContactDetector;

/**
 * Признаки подозрительного сообщения (4.1.3, BR-04): одинаковый текст в нескольких чатах, внешняя ссылка от нового
 * аккаунта, просьба перейти в мессенджер. Подозрительное сообщение доставляется, но с плашкой «Будьте осторожны»
 * у получателя и записью в очередь модерации. Контакты ищет ContactDetector из 5.1.1 — второго детектора нет.
 */
final class SpamDetector
{
    public function __construct(private readonly ContactDetector $contacts) {}

    /**
     * Хеш текста без учёта регистра и пробелов: «Продаю  ДЁШЕВО» и «продаю дёшево» — один текст.
     * Только для сравнения, обратно текст не восстанавливается из хеша в журнал не уходит.
     */
    public static function hash(#[\SensitiveParameter] string $text): string
    {
        $folded = (string) preg_replace('/\s+/u', ' ', mb_strtolower(MessageBody::normalize($text)));

        return sha1(trim($folded));
    }

    /** @return list<SpamSignal> */
    public function detect(User $sender, Conversation $conversation, #[\SensitiveParameter] string $body): array
    {
        $signals = [];

        if ($this->sameTextInManyChats($sender, $conversation, $body)) {
            $signals[] = SpamSignal::SameTextManyChats;
        }
        if ($this->isNewAccount($sender) && $this->contacts->findLink($this->withoutOwnLinks($body)) !== null) {
            $signals[] = SpamSignal::NewAccountLink;
        }
        if ($this->contacts->findMessengerRequest($body) !== null) {
            $signals[] = SpamSignal::MessengerRequest;
        }

        return $signals;
    }

    /** Тот же текст уже отправлен в остальных чатах за окно: вместе с этим — не меньше порога. */
    private function sameTextInManyChats(User $sender, Conversation $conversation, string $body): bool
    {
        $threshold = (int) config('messaging.spam.same_text_chats');
        $otherChats = Message::query()
            ->where('sender_id', $sender->id)
            ->where('body_hash', self::hash($body))
            ->where('created_at', '>=', now()->subHours((int) config('messaging.spam.same_text_window_hours')))
            ->where('conversation_id', '!=', $conversation->id)
            ->distinct()
            ->count('conversation_id');

        return $otherChats + 1 >= $threshold;
    }

    private function isNewAccount(User $sender): bool
    {
        return $sender->created_at !== null
            && $sender->created_at->greaterThan(now()->subHours((int) config('messaging.spam.new_account_hours')));
    }

    /** Ссылки на сам ЯМузыкант (адрес из APP_URL) не внешние: убираются до поиска. */
    private function withoutOwnLinks(string $body): string
    {
        $host = parse_url((string) config('app.url'), PHP_URL_HOST);
        if (! is_string($host) || $host === '') {
            return $body;
        }

        return (string) preg_replace('~(?:https?://)?(?:www\.)?'.preg_quote($host, '~').'(?:[/?#]\S*)?~iu', '', $body);
    }
}
