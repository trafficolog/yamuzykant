<?php

declare(strict_types=1);

namespace App\Domain\Moderation\AutoChecks\Contacts;

/**
 * Контакты в тексте объявления (BR-04: связь только через сообщения): телефон, e-mail, ссылка,
 * название мессенджера, @-ник. Находит и обходы: цифры словами, разделители, разбивку букв,
 * подмену кириллицы латиницей и наоборот, «собака»/«точка» вместо @ и «.».
 *
 * Списки мессенджеров и доменных зон — config/moderation.php. Проверки идут от точных к общим:
 * e-mail, ссылка, ник, телефон, мессенджер; возвращается первое совпадение.
 */
final class ContactDetector
{
    private const EMAIL = '/[\p{L}\p{N}._%+\-]+\s*@\s*[\p{L}\p{N}\-]+(?:\.[\p{L}\p{N}\-]+)+/u';

    private const SCHEME_LINK = '/(?:https?|ftp):\/\/\S+|(?<![\p{L}\p{N}])www\.[\p{L}\p{N}\-]+\.\S+/u';

    private const DOMAIN = '/(?<![\p{L}\p{N}@._\-])((?:[\p{L}\p{N}\-]+\.)+)([\p{L}]{2,})(?![\p{L}\p{N}\-])/u';

    private const HANDLE = '/(?<![\p{L}\p{N}_.@])@[\p{L}\p{N}_]{3,}/u';

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

        // Кириллический и латинский вид текста: «ivаn сoбака mail тoчка ru» читается в обоих.
        $variants = [TextFolding::toCyrillic($folded), TextFolding::toLatin($folded)];

        foreach ($variants as $variant) {
            if (($found = $this->email($variant)) !== null) {
                return new Contact(ContactKind::Email, $found);
            }
        }
        foreach ($variants as $variant) {
            if (($found = $this->link($variant)) !== null) {
                return new Contact(ContactKind::Link, $found);
            }
        }
        if (preg_match(self::HANDLE, $folded, $m) === 1) {
            return new Contact(ContactKind::Handle, $m[0]);
        }
        if (($digits = $this->phones->find($folded)) !== null) {
            return new Contact(ContactKind::Phone, $digits);
        }
        if (($name = $this->messenger($variants)) !== null) {
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
        if ($spelled !== $text && preg_match(self::EMAIL, $spelled, $m) === 1 && $this->knownTld($m[0])) {
            return $m[0];
        }

        return null;
    }

    /** Ссылка со схемой, www или «слово.зона»; зона словами («точка ру») тоже. */
    private function link(string $text): ?string
    {
        foreach ([$text, self::spelledOut($text)] as $candidate) {
            if (preg_match(self::SCHEME_LINK, $candidate, $m) === 1) {
                return $m[0];
            }
            if (preg_match_all(self::DOMAIN, $candidate, $all, PREG_SET_ORDER) > 0) {
                foreach ($all as $match) {
                    if ($this->isTld($match[2])) {
                        return $match[1].$match[2];
                    }
                }
            }
        }

        return null;
    }

    /**
     * @param  list<string>  $variants  текст в кириллическом и латинском виде
     */
    private function messenger(array $variants): ?string
    {
        /** @var list<string> $names */
        $names = (array) config('moderation.contacts.messengers', []);

        $texts = [];
        foreach ($variants as $variant) {
            $texts[] = $variant;
            $texts[] = TextFolding::collapseSpelledOut($variant);
        }

        foreach ($names as $name) {
            $name = TextFolding::lower($name);
            if ($name === '') {
                continue;
            }
            $pattern = '/(?<![\p{L}\p{N}])'.str_replace(' ', '\s+', preg_quote($name, '/')).'/u';
            // Название кириллицей сверяется с кириллическим видом, латиницей — с латинским.
            $offset = TextFolding::hasCyrillic($name) ? 0 : 2;
            $text = $texts[$offset];
            $collapsed = $texts[$offset + 1];
            if (preg_match($pattern, $text, $m) === 1 || preg_match($pattern, $collapsed, $m) === 1) {
                return $m[0];
            }
        }

        return null;
    }

    /** «(at)», «[dot]», « собака », « точка » → «@», «.» */
    private static function spelledOut(string $text): string
    {
        $text = (string) preg_replace('/\s*[(\[{]\s*(?:at|собака)\s*[)\]}]\s*/u', '@', $text);
        $text = (string) preg_replace('/\s*[(\[{]\s*(?:dot|точка)\s*[)\]}]\s*/u', '.', $text);
        $text = (string) preg_replace('/(?<=[\p{L}\p{N}])\s+(?:at|собака)\s+(?=[\p{L}\p{N}])/u', '@', $text);

        return (string) preg_replace('/(?<=[\p{L}\p{N}])\s+(?:dot|точка)\s+(?=[\p{L}\p{N}])/u', '.', $text);
    }

    /** Адрес оканчивается известной доменной зоной (для «собака»/«at»: иначе «Fender at home.Ok» — не почта). */
    private function knownTld(string $address): bool
    {
        $zone = (string) preg_replace('/^.*\./us', '', $address);

        return $this->isTld($zone);
    }

    private function isTld(string $zone): bool
    {
        /** @var list<string> $tlds */
        $tlds = (array) config('moderation.contacts.tlds', []);
        $zone = TextFolding::lower($zone);

        return in_array($zone, $tlds, true) || in_array(TextFolding::toLatin($zone), $tlds, true);
    }
}
