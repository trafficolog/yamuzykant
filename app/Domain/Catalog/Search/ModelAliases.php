<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Search;

/**
 * Русские написания, по которым модель находится (индексное поле `aliases`).
 * «Fender Stratocaster» → [«стратокастер»]: запрос по-русски попадает в документ напрямую.
 * Совпадение — по целым словам (многословный термин — целой фразой), не по подстроке.
 */
final class ModelAliases
{
    /** @return list<string> */
    public static function for(string $brand, string $name): array
    {
        $words = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($brand.' '.$name), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $haystack = ' '.implode(' ', $words).' ';

        /** @var array<string, list<string>> $synonyms */
        $synonyms = config('catalog.model_synonyms', []);

        $aliases = [];
        foreach ($synonyms as $russian => $latinTerms) {
            foreach ($latinTerms as $term) {
                if (str_contains($haystack, ' '.mb_strtolower($term).' ')) {
                    $aliases[] = $russian;

                    break;
                }
            }
        }

        return $aliases;
    }
}
