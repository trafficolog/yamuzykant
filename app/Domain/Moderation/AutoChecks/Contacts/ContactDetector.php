<?php

declare(strict_types=1);

namespace App\Domain\Moderation\AutoChecks\Contacts;

/**
 * Контакты в тексте объявления (BR-04: связь только через сообщения): телефон, e-mail, ссылка,
 * название мессенджера, @-ник. Находит и обходы: цифры словами, разделители, разбивку букв,
 * подмену кириллицы латиницей и наоборот, «собака»/«точка» вместо @ и «.», пробелы вокруг точки и слеша.
 *
 * Мессенджеры, сокращения, доменные зоны и режим блокировки — config/moderation.php. Проверки идут
 * от точных к общим: e-mail, ссылка, ник, телефон, мессенджер; возвращается первое совпадение.
 */
final class ContactDetector
{
    private const EMAIL = '/[\p{L}\p{N}._%+\-]+\s*@\s*[\p{L}\p{N}\-]+(?:\.[\p{L}\p{N}\-]+)+/u';

    private const SCHEME_LINK = '/(?:https?|ftp):\/\/\S+|(?<![\p{L}\p{N}])www\.[\p{L}\p{N}\-]+\.\S+/u';

    /** «t . me / ivan», «vk com slash id1»: короткие адреса мессенджеров и соцсетей, записанные вразбивку. */
    private const SPACED_HOST = '/(?<![\p{L}\p{N}])(?:t|wa|vk)(?:\s*\.\s*|\s+)(?:me|com)\s*(?:\/|slash|слеш)/u';

    private const DOMAIN = '/(?<![\p{L}\p{N}@._\-])((?:[\p{L}\p{N}\-]+\.)+)([\p{L}]{2,})(?![\p{L}\p{N}\-])/u';

    private const HANDLE = '/(?<![\p{L}\p{N}_.@])@[\p{L}\p{N}_]{3,}/u';

    /** Между буквами названия допускаются пробел или знак: «tele gram». Только для основ от 5 букв. */
    private const LETTER_GAP = '[\s.\-_*]{0,2}';

    private readonly PhoneDetector $phones;

    public function __construct(?PhoneDetector $phones = null)
    {
        $this->phones = $phones ?? new PhoneDetector;
    }

    public function find(string $text): ?Contact
    {
        $folded = TextFolding::clean($text);
        if (trim($folded) === '') {
            return null;
        }

        if (($found = $this->email($folded)) !== null) {
            return new Contact(ContactKind::Email, $found);
        }
        if (($found = $this->link($folded)) !== null) {
            return new Contact(ContactKind::Link, $found);
        }
        if (preg_match(self::HANDLE, $folded, $m) === 1) {
            return new Contact(ContactKind::Handle, $m[0]);
        }
        if (($digits = $this->phones->find($folded)) !== null) {
            return new Contact(ContactKind::Phone, $digits);
        }
        if (($name = $this->messenger($folded)) !== null) {
            return new Contact(ContactKind::Messenger, $name);
        }

        return null;
    }

    /** E-mail с «@» или с «собака»/«at», «точка»/«dot» вместо знаков. */
    private function email(string $text): ?string
    {
        if (preg_match(self::EMAIL, $text, $m) === 1) {
            return $m[0];
        }

        $spelled = self::spelledOut($text);
        if ($spelled !== $text && preg_match(self::EMAIL, $spelled, $m) === 1 && $this->isTld(self::zoneOf($m[0]), true)) {
            return $m[0];
        }

        return null;
    }

    /**
     * Ссылка со схемой, www или «слово.зона». Зона сверяется как написана, без замены букв другого алфавита.
     * Зоны из `tlds_spoken` («ру») принимаются, только если адрес записан словами («guitarshop точка ру»).
     */
    private function link(string $text): ?string
    {
        if (preg_match(self::SCHEME_LINK, $text, $m) === 1 || preg_match(self::SPACED_HOST, $text, $m) === 1) {
            return $m[0];
        }

        $spelled = self::spelledOut($text);
        foreach ([[$text, false], [$spelled, true]] as [$candidate, $spoken]) {
            if ($spoken && $candidate === $text) {
                continue;
            }
            if (preg_match_all(self::DOMAIN, $candidate, $all, PREG_SET_ORDER) > 0) {
                foreach ($all as $match) {
                    if ($this->isTld($match[2], $spoken)) {
                        return $match[1].$match[2];
                    }
                }
            }
        }

        return null;
    }

    /** Название мессенджера: основа с начала слова или сокращение целым словом; режим — `block_mention_only`. */
    private function messenger(string $folded): ?string
    {
        $stems = (array) config('moderation.messengers.stems', []);
        $abbreviations = (array) config('moderation.messengers.abbreviations', []);
        $mentionOnly = (bool) config('moderation.messengers.block_mention_only', true);

        // Кириллический и латинский вид текста (и со склеенными буквами вразбивку):
        // названия кириллицей сверяются с первыми двумя, латиницей — с остальными.
        $cyrillic = TextFolding::toCyrillic($folded);
        $latin = TextFolding::toLatin($folded);
        $views = [
            [$cyrillic, TextFolding::collapseSpelledOut($cyrillic)],
            [$latin, TextFolding::collapseSpelledOut($latin)],
        ];

        $patterns = [];
        foreach ($stems as $stem) {
            if (is_string($stem)) {
                $patterns[] = self::stemPattern($stem);
            }
        }
        foreach ($abbreviations as $word) {
            if (is_string($word)) {
                $patterns[] = self::wordPattern($word);
            }
        }

        foreach ($patterns as $pattern) {
            if ($pattern === null) {
                continue;
            }
            [$regex, $isCyrillic] = $pattern;
            foreach ($views[$isCyrillic ? 0 : 1] as $text) {
                if (preg_match_all($regex, $text, $all, PREG_OFFSET_CAPTURE) === 0) {
                    continue;
                }
                foreach ($all[0] as [$hit, $position]) {
                    if ($mentionOnly || self::hasPayload(substr($text, $position + strlen($hit)))) {
                        return $hit;
                    }
                }
            }
        }

        return null;
    }

    /** @return array{0: string, 1: bool}|null шаблон и «название кириллицей» */
    private static function stemPattern(string $stem): ?array
    {
        $stem = str_replace(' ', '', TextFolding::lower(trim($stem)));
        if ($stem === '') {
            return null;
        }

        $letters = array_map(static fn (string $c): string => preg_quote($c, '/'), mb_str_split($stem));
        $body = count($letters) >= 5 ? implode(self::LETTER_GAP, $letters) : implode('', $letters);

        return ['/(?<![\p{L}\p{N}])'.$body.'/u', TextFolding::hasCyrillic($stem)];
    }

    /** @return array{0: string, 1: bool}|null */
    private static function wordPattern(string $word): ?array
    {
        $word = TextFolding::lower(trim($word));
        if ($word === '') {
            return null;
        }

        return ['/(?<![\p{L}\p{N}])'.preg_quote($word, '/').'(?![\p{L}\p{N}])/u', TextFolding::hasCyrillic($word)];
    }

    /**
     * После названия идёт ник или номер: @-ник, идентификатор с «_», с цифрами и буквами или от 6 цифр,
     * а также любое слово после двоеточия («вк: ivan»).
     */
    private static function hasPayload(string $after): bool
    {
        if (preg_match('/^([\s:=\-–—]{0,4})(@?[\p{L}\p{N}_.]+)/u', $after, $m) !== 1) {
            return false;
        }

        $separator = $m[1];
        $token = rtrim($m[2], '.');
        $digits = (int) preg_match_all('/\d/', $token);
        $length = mb_strlen($token);

        return match (true) {
            str_starts_with($token, '@') && $length >= 4 => true,
            str_contains($token, '_') && $length >= 4 => true,
            $digits >= 6 => true,
            $digits >= 1 && $length >= 5 && preg_match('/\p{L}/u', $token) === 1 => true,
            str_contains($separator, ':') && $length >= 3 => true,
            default => false,
        };
    }

    /** «(at)», «[dot]», « собака », « точка » → «@», «.»; слова ищутся и с подменой букв другого алфавита. */
    private static function spelledOut(string $text): string
    {
        $at = self::either('at', 'собака');
        $dot = self::either('dot', 'точка');

        $text = (string) preg_replace('/\s*[(\[{]\s*'.$at.'\s*[)\]}]\s*/u', '@', $text);
        $text = (string) preg_replace('/\s*[(\[{]\s*'.$dot.'\s*[)\]}]\s*/u', '.', $text);
        $text = (string) preg_replace('/(?<=[\p{L}\p{N}])\s+'.$at.'\s+(?=[\p{L}\p{N}])/u', '@', $text);

        return (string) preg_replace('/(?<=[\p{L}\p{N}])\s+'.$dot.'\s+(?=[\p{L}\p{N}])/u', '.', $text);
    }

    private static function either(string $latin, string $cyrillic): string
    {
        return '(?:'.TextFolding::tolerant($latin).'|'.TextFolding::tolerant($cyrillic).')';
    }

    private static function zoneOf(string $address): string
    {
        return (string) preg_replace('/^.*\./us', '', $address);
    }

    /** Зона из списка как написана: без замены похожих букв. */
    private function isTld(string $zone, bool $spoken): bool
    {
        $zone = TextFolding::lower($zone);
        $lists = $spoken ? ['tlds', 'tlds_spoken'] : ['tlds'];
        foreach ($lists as $list) {
            if (in_array($zone, (array) config("moderation.contacts.{$list}", []), true)) {
                return true;
            }
        }

        return false;
    }
}
