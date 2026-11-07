<?php

declare(strict_types=1);

namespace Tests\Support;

/**
 * Меню категорий из макета «Шапка» (design/prototypes/Шапка.dc.html): вид → группа → пункты.
 *
 * Разбор не зависит от форматирования: отступы, переносы строк и кавычки (одинарные или двойные) не важны.
 * «Мастера и ремонт» — раздел услуг, не вид инструмента, в результат не входит.
 */
final class MenuPrototype
{
    /**
     * @return list<array{name: string, groups: list<array{title: string, items: list<string>}>}>
     */
    public static function parse(string $html): array
    {
        preg_match_all(
            '/\{\s*name:\s*(["\'])(.+?)\1\s*,\s*icon:|\{\s*title:\s*(["\'])(.+?)\3\s*,\s*items:\s*\[(.*?)\]/su',
            $html,
            $matches,
            PREG_SET_ORDER,
        );

        $kinds = [];
        foreach ($matches as $match) {
            if (($match[2] ?? '') !== '') {
                $kinds[] = ['name' => $match[2], 'groups' => []];

                continue;
            }

            if (($match[4] ?? '') !== '' && $kinds !== []) {
                preg_match_all('/(["\'])(.+?)\1/u', $match[5] ?? '', $items);

                $last = array_key_last($kinds);
                $kinds[$last]['groups'][] = ['title' => $match[4], 'items' => $items[2]];
            }
        }

        return array_values(array_filter($kinds, fn (array $kind): bool => $kind['name'] !== 'Мастера и ремонт'));
    }
}
