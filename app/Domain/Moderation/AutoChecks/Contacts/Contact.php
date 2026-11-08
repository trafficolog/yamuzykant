<?php

declare(strict_types=1);

namespace App\Domain\Moderation\AutoChecks\Contacts;

/** Найденный контакт: вид и фрагмент текста для пояснения модератору. */
final readonly class Contact
{
    public function __construct(
        public ContactKind $kind,
        public string $excerpt,
    ) {}
}
