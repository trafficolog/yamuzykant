<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Search;

/**
 * Русские написания, по которым модель находится (индексное поле `aliases`).
 * «Fender Stratocaster» → [«стратокастер»]: запрос по-русски попадает в документ напрямую.
 */
final class ModelAliases
{
    /** @return list<string> */
    public static function for(string $brand, string $name): array
    {
        $haystack = mb_strtolower($brand.' '.$name);
        $aliases = [];

        /** @var array<string, list<string>> $synonyms */
        $synonyms = config('catalog.model_synonyms', []);

        foreach ($synonyms as $russian => $latinTerms) {
            foreach ($latinTerms as $term) {
                if (str_contains($haystack, mb_strtolower($term))) {
                    $aliases[] = $russian;

                    break;
                }
            }
        }

        return $aliases;
    }
}
