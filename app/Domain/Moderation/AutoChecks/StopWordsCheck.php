<?php

declare(strict_types=1);

namespace App\Domain\Moderation\AutoChecks;

use App\Domain\Listings\Models\Listing;
use App\Domain\Moderation\AutoChecks\Contacts\TextFolding;

/**
 * Стоп-слова в названии и описании. Список — config/moderation.php (`stop_words`, до справочника 5.3.3).
 * Совпадение — целое слово или фраза без учёта регистра и «ё»; подмена букв другого алфавита не помогает.
 * Только сигнал риска: объявление не блокируется.
 */
final class StopWordsCheck implements AutoCheck
{
    private const FIELDS = ['title', 'description'];

    public function code(): string
    {
        return 'stop_words';
    }

    public function blocking(): bool
    {
        return false;
    }

    public function inspect(Listing $listing): array
    {
        /** @var list<string> $words */
        $words = array_values(array_filter((array) config('moderation.stop_words', []), 'is_string'));
        if ($words === []) {
            return [];
        }

        $findings = [];
        foreach (self::FIELDS as $field) {
            $text = $listing->{$field};
            if (! is_string($text) || $text === '') {
                continue;
            }

            $found = $this->matches($text, $words);
            if ($found === []) {
                continue;
            }

            $findings[] = new Finding(
                code: $this->code(),
                field: $field,
                message: (string) __('moderation.signals.stop_words', [
                    'field' => (string) __("moderation.fields.{$field}"),
                    'words' => implode(', ', $found),
                ]),
                details: ['words' => $found],
            );
        }

        return $findings;
    }

    /**
     * @param  list<string>  $words
     * @return list<string> сработавшие стоп-слова в написании конфига
     */
    private function matches(string $text, array $words): array
    {
        $folded = TextFolding::clean($text);
        $variants = [TextFolding::toCyrillic($folded), TextFolding::toLatin($folded)];

        $found = [];
        foreach ($words as $word) {
            $needle = TextFolding::lower(trim($word));
            if ($needle === '') {
                continue;
            }

            $pattern = '/(?<![\p{L}\p{N}])'.str_replace(' ', '\s+', preg_quote($needle, '/')).'(?![\p{L}\p{N}])/u';
            $variant = $variants[TextFolding::hasCyrillic($needle) ? 0 : 1];
            if (preg_match($pattern, $variant) === 1) {
                $found[] = $word;
            }
        }

        return $found;
    }
}
