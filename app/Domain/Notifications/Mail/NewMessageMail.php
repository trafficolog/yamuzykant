<?php

declare(strict_types=1);

namespace App\Domain\Notifications\Mail;

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Models\Message;
use App\Domain\Notifications\Enums\NotificationKind;
use App\Support\Rubles;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Lang;

/**
 * Письмо получателю о новом сообщении (4.4.1). Отправляется из очередного слушателя, сам в очередь не ставится.
 * Без почты собеседника и без текста сообщения (BR-04): имя собеседника и объявление уже видны в чате,
 * текст читают в чате.
 */
final class NewMessageMail extends Mailable
{
    public function __construct(public readonly User $recipient, public readonly Message $message) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: Lang::get('mail.new_message.subject', ['name' => $this->senderName()]));
    }

    public function content(): Content
    {
        $conversation = $this->message->conversation;
        $listing = $conversation->listing;

        return new Content(
            markdown: 'mail.new-message',
            with: [
                'senderName' => $this->senderName(),
                'listingTitle' => $listing->title,
                'price' => $listing->price === null ? null : Rubles::format($listing->price),
                'chatUrl' => route('messages.show', $conversation),
                'reason' => Lang::get('mail.reasons.new_message', ['minutes' => Config::integer('notifications.new_message_mail_interval_minutes')]),
                'unsubscribeUrl' => NotificationKind::NewMessage->unsubscribeUrl($this->recipient),
            ],
        );
    }

    /** Отписка в один клик в самом почтовом клиенте (RFC 8058). */
    public function headers(): Headers
    {
        return new Headers(text: [
            'List-Unsubscribe' => '<'.NotificationKind::NewMessage->unsubscribeUrl($this->recipient).'>',
            'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
        ]);
    }

    private function senderName(): string
    {
        $sender = $this->message->sender;

        return $sender === null ? '' : $sender->name;
    }
}
