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
    private function __construct(#[\SensitiveParameter] public readonly string $value) {}

    /**
     * Текст не выводится ни в var_dump, ни в дампах.
     *
     * @return array<string, mixed>
     */
    public function __debugInfo(): array
    {
        return [];
    }

    /** @throws InvalidArgumentException пустой после нормализации или длиннее $maxLength символов */
    public static function from(#[\SensitiveParameter] string $text, ?int $maxLength = null): self
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

    public static function normalize(#[\SensitiveParameter] string $text): string
    {
        // U+2028/2029 (разделители строки и абзаца) — обычный перевод строки.
        $text = str_replace(["\r\n", "\r", "\u{2028}", "\u{2029}"], "\n", $text);
        // C0 и C1, кроме \t и \n; DEL; невидимые символы, которыми прячут ссылки и контакты: мягкий перенос U+00AD,
        // U+034F, ALM U+061C, хангыль-заполнители (U+115F, U+1160, U+3164, U+FFA0), zero-width и управление
        // направлением (U+200B–U+200F, U+202A–U+202E, U+2060–U+206F, включая невидимые операторы и устаревшие
        // форматирующие), U+FEFF, аннотации U+FFF9–U+FFFB.
        $text = (string) preg_replace('/[\x{0000}-\x{0008}\x{000B}-\x{001F}\x{007F}-\x{009F}\x{00AD}\x{034F}\x{061C}\x{115F}\x{1160}\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2060}-\x{206F}\x{3164}\x{FEFF}\x{FFA0}\x{FFF9}-\x{FFFB}]/u', '', $text);
        $text = (string) preg_replace("/\n{3,}/", "\n\n", $text);

        return trim($text);
    }
}
