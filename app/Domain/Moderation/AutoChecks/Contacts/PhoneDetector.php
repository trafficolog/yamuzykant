<?php

declare(strict_types=1);

namespace App\Domain\Moderation\AutoChecks\Contacts;

/**
 * Телефон в тексте: цифры в любой записи (слитно, с пробелами, скобками, дефисами, точками, запятыми,
 * каждая отдельно) и числительные словами. Ищется последовательность из 10–13 цифр, похожая на номер:
 * 11 цифр с 7 или 8, 10 цифр мобильного с 9, номер с «+», городской с кодом и привычной разбивкой.
 *
 * Год, цена, модель (DX7, SM58), дата, размер и частота телефоном не считаются: цифры, прилипшие
 * к латинским или кириллическим буквам, — часть слова; группы разрываются любым словом; пара «цена + год»
 * («950 000, 1957») отсекается отдельно.
 */
final class PhoneDetector
{
    /** Слитно с буквами число считается отдельным только от этой длины («тел89161234567»); короче — часть слова («SM58»). */
    private const GLUED_MIN = 9;

    private const MIN_DIGITS = 10;

    private const MAX_DIGITS = 13;

    /** Разделители между цифрами одного номера. */
    private const GAP = '/^[\s\-–—_.,*\/|()\[\]+:~•·]{0,4}$/u';

    /**
     * @param  string  $folded  текст после TextFolding::clean()
     * @return string|null найденные цифры номера
     */
    public function find(string $folded): ?string
    {
        // Буквы вместо цифр: внутри числа («89l6l234567», «9O0») и в начале группы («8(916)l23»).
        $text = (string) preg_replace(
            ['/(?<=\d)[oо](?=\d)/u', '/(?<=\d)[liі](?=\d)/u', '/(?<![\p{L}\p{N}])[liі](?=\d)/u'],
            ['0', '1', '1'],
            NumberWords::toDigits($folded),
        );

        if (preg_match_all('/\d+/', $text, $found, PREG_OFFSET_CAPTURE) === 0) {
            return null;
        }

        /** @var list<array{digits: string, start: int, end: int}> $groups */
        $groups = [];
        foreach ($found[0] as [$digits, $start]) {
            $digits = (string) $digits;
            $end = $start + strlen($digits);
            if (strlen($digits) < self::GLUED_MIN && (self::letterBefore($text, $start) || self::letterAfter($text, $end))) {
                $groups[] = ['digits' => '', 'start' => $start, 'end' => $end]; // часть слова: разрывает номер
            } else {
                $groups[] = ['digits' => $digits, 'start' => $start, 'end' => $end];
            }
        }

        foreach ($this->runs($text, $groups) as $run) {
            $phone = $this->findInRun($text, $run);
            if ($phone !== null) {
                return $phone;
            }
        }

        return null;
    }

    /**
     * Цепочки групп цифр, между которыми только разделители.
     *
     * @param  list<array{digits: string, start: int, end: int}>  $groups
     * @return list<list<array{digits: string, start: int, end: int}>>
     */
    private function runs(string $text, array $groups): array
    {
        $runs = [];
        $current = [];
        foreach ($groups as $group) {
            if ($group['digits'] === '') {
                $runs[] = $current;
                $current = [];

                continue;
            }
            if ($current !== []) {
                $previous = $current[array_key_last($current)];
                $gap = substr($text, $previous['end'], $group['start'] - $previous['end']);
                if (preg_match(self::GAP, $gap) !== 1) {
                    $runs[] = $current;
                    $current = [];
                }
            }
            $current[] = $group;
        }
        $runs[] = $current;

        return array_values(array_filter($runs, static fn (array $run): bool => $run !== []));
    }

    /**
     * @param  list<array{digits: string, start: int, end: int}>  $run
     */
    private function findInRun(string $text, array $run): ?string
    {
        $count = count($run);
        for ($i = 0; $i < $count; $i++) {
            $sum = 0;
            for ($j = $i; $j < $count; $j++) {
                $sum += strlen($run[$j]['digits']);
                if ($sum > self::MAX_DIGITS) {
                    break;
                }
                if ($sum < self::MIN_DIGITS) {
                    continue;
                }

                $window = array_slice($run, $i, $j - $i + 1);
                $plus = self::plusBefore($text, $window[0]['start']);
                if (self::looksLikePhone(array_column($window, 'digits'), $plus)) {
                    return implode('', array_column($window, 'digits'));
                }
            }
        }

        return null;
    }

    /** @param  list<string>  $groups */
    private static function looksLikePhone(array $groups, bool $plus): bool
    {
        $digits = implode('', $groups);
        $length = strlen($digits);

        if (self::priceAndYear($groups)) {
            return false;
        }

        // Международный префикс «00 7…», «00 375…» равносилен «+».
        if ($length >= 12 && preg_match('/^00(7|3\d\d)/', $digits) === 1) {
            $digits = substr($digits, 2);
            $length -= 2;
            $plus = true;
        }

        return match (true) {
            $length === 11 && ($digits[0] === '7' || $digits[0] === '8') => true,
            $length === 10 && $digits[0] === '9' => true,
            $plus && $length >= 11 && $length <= self::MAX_DIGITS => true,
            $length === 12 && preg_match('/^3[78]\d/', $digits) === 1 => true,
            $length === 10 && in_array($digits[0], ['3', '4', '8'], true) => self::cityShape($groups),
            default => false,
        };
    }

    /**
     * Городской номер: код и семь цифр слитно, одной группой или «xxx xxx xx xx».
     *
     * @param  list<string>  $groups
     */
    private static function cityShape(array $groups): bool
    {
        if (count($groups) === 1) {
            return true;
        }

        $tail = array_map('strlen', array_slice($groups, -2));

        return $tail[1] === 7 || $tail === [2, 2];
    }

    /**
     * «Цена + год»: последняя группа — год (1800–2100), перед ней группа тысяч, оканчивающаяся на «00»
     * («950 000 1957», «450 500 1983»).
     *
     * @param  list<string>  $groups
     */
    private static function priceAndYear(array $groups): bool
    {
        $count = count($groups);
        if ($count < 3) {
            return false;
        }

        $year = $groups[$count - 1];
        $thousands = $groups[$count - 2];

        return strlen($year) === 4
            && (int) $year >= 1800 && (int) $year <= 2100
            && strlen($thousands) === 3
            && str_ends_with($thousands, '00');
    }

    private static function plusBefore(string $text, int $offset): bool
    {
        return preg_match('/\+[\s(\-]*$/', substr($text, max(0, $offset - 6), min(6, $offset))) === 1;
    }

    private static function letterBefore(string $text, int $offset): bool
    {
        return $offset > 0 && preg_match('/^\p{L}$/u', mb_substr(substr($text, 0, $offset), -1)) === 1;
    }

    private static function letterAfter(string $text, int $offset): bool
    {
        return preg_match('/^\p{L}$/u', mb_substr(substr($text, $offset, 8), 0, 1)) === 1;
    }
}
