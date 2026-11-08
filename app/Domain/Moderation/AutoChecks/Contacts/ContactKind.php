<?php

declare(strict_types=1);

namespace App\Domain\Moderation\AutoChecks\Contacts;

/** Вид найденного в тексте контакта (BR-04). */
enum ContactKind: string
{
    case Phone = 'phone';
    case Email = 'email';
    case Link = 'link';
    case Messenger = 'messenger';
    case Handle = 'handle';
}
