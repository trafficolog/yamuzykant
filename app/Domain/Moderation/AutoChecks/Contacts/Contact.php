<?php

declare(strict_types=1);

namespace App\Domain\Moderation\AutoChecks\Contacts;

/**
 * Найденный контакт: вид и исходный фрагмент. В хранилище (moderation_flags) и в пояснения уходит только
 * маска: чужие телефон и почта не копируются в журналы модерации.
 */
final readonly class Contact
{
    /** Длина маски не больше этого. */
    private const MASK_MAX = 40;

    public function __construct(
        public ContactKind $kind,
        public string $excerpt,
    ) {}

    /** «79*******67», «i***@mail.ru», «example.com» (домен без пути), «@iv***», название мессенджера. */
    public function masked(): string
    {
        $text = trim($this->excerpt);

        $masked = match ($this->kind) {
            ContactKind::Phone => self::maskDigits((string) preg_replace('/\D/', '', $text)),
            ContactKind::Email => self::maskEmail($text),
            ContactKind::Link => self::host($text),
            ContactKind::Handle => mb_substr($text, 0, 3).'***',
            ContactKind::Messenger => $text,
        };

        return mb_substr($masked, 0, self::MASK_MAX);
    }

    private static function maskDigits(string $digits): string
    {
        $length = strlen($digits);

        return $length <= 4 ? '***' : substr($digits, 0, 2).str_repeat('*', $length - 4).substr($digits, -2);
    }

    private static function maskEmail(string $text): string
    {
        $at = strrpos($text, '@');
        if ($at === false || $at === 0) {
            return '***';
        }

        return mb_substr($text, 0, 1).'***@'.substr($text, $at + 1);
    }

    private static function host(string $text): string
    {
        $text = (string) preg_replace('/\s+/u', '', $text);

        return (string) preg_replace('~^(?:[a-z][a-z0-9+.\-]*://)?([^/?#]*).*$~isu', '$1', $text);
    }
}
