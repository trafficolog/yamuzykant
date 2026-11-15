<?php

declare(strict_types=1);

namespace App\Domain\Notifications\Listeners;

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Events\MessageSent;
use App\Domain\Notifications\Enums\NotificationKind;
use App\Domain\Notifications\Mail\NewMessageMail;
use App\Domain\Notifications\NotificationPreferences;
use App\Domain\Notifications\Presence;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Mail;

/**
 * Письмо о новом сообщении (4.4.1, UC-N1). Идёт в очереди после commit сообщения (MessageSent — after commit).
 * Не шлётся, если: получатель выключил письма (NotificationPreferences), он «в сети» (Presence), сообщение уже прочитано,
 * или в этот чат ему уже писали письмо в последние `notifications.new_message_mail_interval_minutes` минут.
 */
final class SendNewMessageEmail implements ShouldQueue
{
    public bool $afterCommit = true;

    public function handle(MessageSent $event): void
    {
        $message = $event->message;
        $conversation = $message->conversation;

        $sender = $message->sender;
        $recipientId = $sender === null ? null : $conversation->counterpartId($sender);
        $recipient = $recipientId === null ? null : User::query()->find($recipientId);

        if ($recipient === null
            || $message->read_at !== null
            || ! NotificationPreferences::allows($recipient, NotificationKind::NewMessage)
            || Presence::isOnline($recipient)) {
            return;
        }

        // Атомарно: параллельные сообщения в одном чате дают одно письмо. Проверка последней — чтобы отказ выше не занимал окно.
        $window = now()->addMinutes(Config::integer('notifications.new_message_mail_interval_minutes'));
        if (! Cache::add("notifications:new_message:{$conversation->id}:{$recipient->id}", true, $window)) {
            return;
        }

        Mail::to($recipient->email)->send(new NewMessageMail($recipient, $message));
    }
}
