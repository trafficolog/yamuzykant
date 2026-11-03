import { usePage } from '@inertiajs/react';

/**
 * Имена флагов, которые сервер отдаёт в shared prop `flags` (App\Support\Flags\FeatureFlag).
 * Сверяются с enum тестом tests/js/Hooks/flag-names.test.ts: новый флаг без правки списка роняет тест.
 */
export const FLAG_NAMES = [
    'catalog_new',
    'masters',
    'sale_prices',
    'accessories',
    'companies',
    'wallet',
    'safe_deal',
    'r1_public',
    'premoderation',
] as const;

export type FlagName = (typeof FLAG_NAMES)[number];

// Тип-алиас, а не interface: PageProps из @inertiajs/core требует индексной сигнатуры.
type FlagsProps = {
    flags?: Partial<Record<FlagName, boolean>>;
};

/** Значение флага из Inertia shared props. Без значения от сервера флаг выключен. */
export function useFlag(name: FlagName): boolean {
    const { props } = usePage<FlagsProps>();

    return props.flags?.[name] === true;
}
