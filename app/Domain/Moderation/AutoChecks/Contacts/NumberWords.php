<?php

declare(strict_types=1);

namespace App\Domain\Moderation\AutoChecks\Contacts;

/**
 * Числа, записанные словами («восемь девятьсот шестнадцать…», «eight nine one…»), превращаются в цифры,
 * чтобы телефон словами проверялся так же, как телефон цифрами. Подряд идущие числительные склеиваются
 * по правилам разряда: «девятьсот шестнадцать» → 916, «двадцать пять» → 25, «один два» → 1 2.
 * Слово ищется как есть и с подменой букв другого алфавита («oдин» с латинской «o»).
 */
final class NumberWords
{
    private const UNIT = 'unit';

    private const ZERO = 'zero';

    private const TEEN = 'teen';

    private const TENS = 'tens';

    private const HUNDRED = 'hundred';

    private const PLUS = 'plus';

    /** Слова между числительными одного номера: пробелы и знаки, не больше трёх подряд. */
    private const GAP = '/^[\s,.\-–—]{0,3}$/u';

    /** @var array<string, array{0: string, 1: string}>|null слово → [цифры, вид] */
    private static ?array $words = null;

    /**
     * @return string текст, где числительные заменены цифрами (группы разделены пробелами)
     */
    public static function toDigits(string $text): string
    {
        if (preg_match_all('/\p{L}+/u', $text, $found, PREG_OFFSET_CAPTURE) === 0) {
            return $text;
        }

        $hits = [];
        foreach ($found[0] as [$word, $offset]) {
            $info = self::lookup((string) $word);
            if ($info !== null) {
                $hits[] = ['start' => $offset, 'end' => $offset + strlen((string) $word), 'info' => $info];
            }
        }
        if ($hits === []) {
            return $text;
        }

        $runs = [];
        foreach ($hits as $hit) {
            $last = array_key_last($runs);
            if ($last !== null && preg_match(self::GAP, substr($text, $runs[$last]['end'], $hit['start'] - $runs[$last]['end'])) === 1) {
                $runs[$last]['end'] = $hit['end'];
                $runs[$last]['infos'][] = $hit['info'];
            } else {
                $runs[] = ['start' => $hit['start'], 'end' => $hit['end'], 'infos' => [$hit['info']]];
            }
        }

        $out = '';
        $pos = 0;
        foreach ($runs as $run) {
            $out .= substr($text, $pos, $run['start'] - $pos).' '.implode(' ', self::merge($run['infos'])).' ';
            $pos = $run['end'];
        }

        return $out.substr($text, $pos);
    }

    /**
     * @param  list<array{0: string, 1: string}>  $infos
     * @return list<string>
     */
    private static function merge(array $infos): array
    {
        $groups = [];
        $lastKind = null;

        foreach ($infos as [$digits, $kind]) {
            $index = array_key_last($groups);
            $last = $index === null ? null : $groups[$index];

            if ($last !== null && $lastKind === self::HUNDRED && in_array($kind, [self::TEEN, self::TENS, self::UNIT], true)) {
                $groups[$index] = $last[0].str_pad($digits, 2, '0', STR_PAD_LEFT);
                $lastKind = $kind === self::TENS ? 'hundred_tens' : 'merged';
            } elseif ($last !== null && in_array($lastKind, [self::TENS, 'hundred_tens'], true) && $kind === self::UNIT) {
                $groups[$index] = substr($last, 0, -1).$digits;
                $lastKind = 'merged';
            } else {
                $groups[] = $digits;
                $lastKind = $kind;
            }
        }

        return $groups;
    }

    /** @return array{0: string, 1: string}|null */
    private static function lookup(string $word): ?array
    {
        $words = self::$words ??= self::table();
        $lower = TextFolding::lower($word);

        return $words[$lower]
            ?? $words[TextFolding::toCyrillic($lower)]
            ?? $words[TextFolding::toLatin($lower)]
            ?? null;
    }

    /** @return array<string, array{0: string, 1: string}> */
    private static function table(): array
    {
        $table = [];
        $add = static function (array $words, string $digits, string $kind) use (&$table): void {
            foreach ($words as $word) {
                $table[$word] = [$digits, $kind];
            }
        };

        $add(['ноль', 'нуль', 'zero'], '0', self::ZERO);
        $add(['один', 'одна', 'одно', 'одну', 'one'], '1', self::UNIT);
        $add(['два', 'две', 'two'], '2', self::UNIT);
        $add(['три', 'three'], '3', self::UNIT);
        $add(['четыре', 'four'], '4', self::UNIT);
        $add(['пять', 'five'], '5', self::UNIT);
        $add(['шесть', 'six'], '6', self::UNIT);
        $add(['семь', 'seven'], '7', self::UNIT);
        $add(['восемь', 'eight'], '8', self::UNIT);
        $add(['девять', 'nine'], '9', self::UNIT);

        foreach (['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'] as $i => $word) {
            $add([$word], (string) (10 + $i), self::TEEN);
        }
        foreach (['двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'] as $i => $word) {
            $add([$word], (string) (($i + 2) * 10), self::TENS);
        }
        foreach (['сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'] as $i => $word) {
            $add([$word], (string) (($i + 1) * 100), self::HUNDRED);
        }
        $add(['плюс', 'plus'], '+', self::PLUS);

        return $table;
    }
}
