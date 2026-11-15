<?php

declare(strict_types=1);

return [
    // Письмо о новом сообщении (4.4.1): не чаще одного раза за окно на чат и получателя.
    'new_message_mail_interval_minutes' => 15,

    // Собеседник «в сети», если от него был запрос не позже, чем столько минут назад (Presence).
    'online_minutes' => 5,
];
