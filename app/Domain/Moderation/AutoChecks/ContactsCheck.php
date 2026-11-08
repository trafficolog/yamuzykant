<?php

declare(strict_types=1);

namespace App\Domain\Moderation\AutoChecks;

use App\Domain\Listings\Models\Listing;
use App\Domain\Moderation\AutoChecks\Contacts\ContactDetector;

/**
 * Контакты в названии и описании (BR-04): телефон, e-mail, ссылка, мессенджер, @-ник.
 * Блокирует отправку формы и публикацию; найденное остаётся и сигналом риска.
 */
final class ContactsCheck implements AutoCheck
{
    /** Проверяемые поля. Серийный номер — идентификатор, не текст для покупателей. */
    private const FIELDS = ['title', 'description'];

    public function __construct(private readonly ContactDetector $detector) {}

    public function code(): string
    {
        return 'contacts';
    }

    public function blocking(): bool
    {
        return true;
    }

    public function inspect(Listing $listing): array
    {
        $findings = [];
        foreach (self::FIELDS as $field) {
            $text = $listing->{$field};
            if (! is_string($text) || $text === '') {
                continue;
            }

            $contact = $this->detector->find($text);
            if ($contact === null) {
                continue;
            }

            $findings[] = new Finding(
                code: $this->code(),
                field: $field,
                message: (string) __('moderation.contacts.signal', [
                    'field' => (string) __("moderation.fields.{$field}"),
                    'kind' => (string) __("moderation.contacts.kinds.{$contact->kind->value}"),
                    'excerpt' => $contact->excerpt,
                ]),
                details: ['kind' => $contact->kind->value, 'excerpt' => $contact->excerpt],
                hint: (string) __("moderation.contacts.hint.{$field}"),
            );
        }

        return $findings;
    }
}
