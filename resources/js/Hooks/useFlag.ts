import { usePage } from '@inertiajs/react';

/** Имена флагов, которые сервер отдаёт в shared prop `flags` (см. App\Support\Flags\FeatureFlag). */
export type FlagName =
    | 'catalog_new'
    | 'masters'
    | 'sale_prices'
    | 'accessories'
    | 'companies'
    | 'wallet'
    | 'safe_deal'
    | 'r1_public'
    | 'premoderation';

// Тип-алиас, а не interface: PageProps из @inertiajs/core требует индексной сигнатуры.
type FlagsProps = {
    flags?: Partial<Record<FlagName, boolean>>;
};

/** Значение флага из Inertia shared props. Без значения от сервера флаг выключен. */
export function useFlag(name: FlagName): boolean {
    const { props } = usePage<FlagsProps>();

    return props.flags?.[name] === true;
}
