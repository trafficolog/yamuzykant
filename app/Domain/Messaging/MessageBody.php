<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use InvalidArgumentException;

/**
 * Текст сообщения. Хранится как есть, без HTML-экранирования: экранирует отображение (текстовые узлы React,
 * JSON). Здесь — только нормализация: края без пробелов, переводы строк `\n`, без управляющих
 * и невидимых символов направления текста (ими маскируют вид ссылок), не больше одной пустой строки подряд.
 */
final class MessageBody
{
    private function __construct(public readonly string $value) {}

    /** @throws InvalidArgumentException пустой после нормализации или длиннее $maxLength символов */
    public static function from(string $text, ?int $maxLength = null): self
    {
        $value = self::normalize($text);
        $maxLength ??= (int) config('messaging.max_length');

        if ($value === '') {
            throw new InvalidArgumentException('Пустое сообщение.');
        }

        if (mb_strlen($value) > $maxLength) {
            throw new InvalidArgumentException('Сообщение длиннее допустимого.');
        }

        return new self($value);
    }

    public static function normalize(string $text): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        // C0 и C1, кроме \t и \n; DEL; zero-width и управление направлением (U+200B–U+200F, U+202A–U+202E,
        // U+2066–U+2069, U+FEFF).
        $text = (string) preg_replace('/[\x{0000}-\x{0008}\x{000B}-\x{001F}\x{007F}-\x{009F}\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}\x{FEFF}]/u', '', $text);
        $text = (string) preg_replace("/\n{3,}/", "\n\n", $text);

        return trim($text);
    }
}
