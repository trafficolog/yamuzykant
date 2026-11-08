<?php

declare(strict_types=1);

namespace App\Domain\Moderation\AutoChecks\Contacts;

use IntlChar;
use Normalizer;

/**
 * Приведение текста объявления к виду, в котором обходы выглядят как обычные слова и цифры:
 * невидимые символы убраны, полноширинные и «чужие» цифры стали ASCII, регистр и «ё» сняты,
 * а похожие буквы двух алфавитов сводятся к одному (так «ватсап» с латинской «a» находится и как кириллица,
 * и как латиница).
 */
final class TextFolding
{
    /** Латинская буква → похожая кириллическая. */
    private const LATIN_TO_CYRILLIC = [
        'a' => 'а', 'b' => 'в', 'c' => 'с', 'e' => 'е', 'h' => 'н', 'k' => 'к', 'm' => 'м',
        'o' => 'о', 'p' => 'р', 't' => 'т', 'x' => 'х', 'y' => 'у',
    ];

    /** Кириллическая (и близкая к ней) буква → похожая латинская. */
    private const CYRILLIC_TO_LATIN = [
        'а' => 'a', 'в' => 'b', 'с' => 'c', 'е' => 'e', 'н' => 'h', 'к' => 'k', 'м' => 'm',
        'о' => 'o', 'р' => 'p', 'т' => 't', 'х' => 'x', 'у' => 'y',
        'һ' => 'h', 'і' => 'i', 'ѕ' => 's', 'ј' => 'j', 'ԁ' => 'd', 'ԛ' => 'q', 'ɡ' => 'g',
        'ο' => 'o', 'α' => 'a', 'ε' => 'e', 'ρ' => 'p', 'ν' => 'v', 'τ' => 't',
    ];

    /**
     * Невидимые символы, нулевая ширина, мягкий перенос, вариационный селектор и рамка эмодзи-цифр
     * вырезаются: «8⃣9⃣» и «8​9» читаются как «89».
     */
    public static function clean(string $text): string
    {
        $text = (string) preg_replace('/[\x{00AD}\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2060}-\x{2064}\x{FE00}-\x{FE0F}\x{20E3}\x{FEFF}]/u', '', $text);

        if (class_exists(Normalizer::class)) {
            $text = Normalizer::normalize($text, Normalizer::FORM_KC) ?: $text;
        }

        // Цифры других письменностей (арабско-индийские и т. п.) — в ASCII.
        $text = (string) preg_replace_callback('/\p{Nd}/u', static function (array $m): string {
            if (class_exists(IntlChar::class)) {
                $value = IntlChar::charDigitValue(mb_ord($m[0]));

                return $value >= 0 ? (string) $value : $m[0];
            }

            return $m[0];
        }, $text);

        return self::lower($text);
    }

    public static function lower(string $text): string
    {
        return str_replace('ё', 'е', mb_strtolower($text));
    }

    public static function toCyrillic(string $text): string
    {
        return strtr($text, self::LATIN_TO_CYRILLIC);
    }

    public static function toLatin(string $text): string
    {
        return strtr($text, self::CYRILLIC_TO_LATIN);
    }

    /**
     * Шаблон слова, в котором каждая буква может быть и своей, и похожей из другого алфавита:
     * «собака» совпадёт и с «сoбaкa» (латинские o, a).
     */
    public static function tolerant(string $word): string
    {
        $parts = [];
        foreach (mb_str_split($word) as $char) {
            $set = array_unique([
                $char,
                self::LATIN_TO_CYRILLIC[$char] ?? $char,
                self::CYRILLIC_TO_LATIN[$char] ?? $char,
            ]);
            $parts[] = '['.implode('', array_map(static fn (string $c): string => preg_quote($c, '/'), $set)).']';
        }

        return implode('', $parts);
    }

    public static function hasCyrillic(string $text): bool
    {
        return preg_match('/\p{Cyrillic}/u', $text) === 1;
    }

    /**
     * «в а т с а п», «w.h.a.t.s.a.p.p» → «ватсап», «whatsapp»: четыре и больше одиночных буквы подряд через
     * пробелы и знаки склеиваются.
     */
    public static function collapseSpelledOut(string $text): string
    {
        return (string) preg_replace_callback(
            '/(?<![\p{L}\p{N}])(?:\p{L}[\s.\-_*]+){3,}\p{L}(?![\p{L}\p{N}])/u',
            static fn (array $m): string => (string) preg_replace('/[\s.\-_*]+/u', '', $m[0]),
            $text,
        );
    }
}
