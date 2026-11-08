<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Spam;

/** Признак подозрительного сообщения (4.1.3). Значение — код в message_flags.signals. */
enum SpamSignal: string
{
    /** Одинаковый текст в ≥ messaging.spam.same_text_chats разных чатах за окно. */
    case SameTextManyChats = 'same_text';

    /** Внешняя ссылка от аккаунта младше messaging.spam.new_account_hours. */
    case NewAccountLink = 'new_account_link';

    /** Просьба перейти в мессенджер: название мессенджера или @-ник. */
    case MessengerRequest = 'messenger_request';
}
