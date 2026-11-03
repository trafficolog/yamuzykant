import { Footer } from '@ds';

import { useFlag, type FlagName } from '@/Hooks/useFlag';
import { ru } from '@/lang/ru';

/** Элемент подвала; без `flag` показывается всегда. */
interface Entry {
    label: string;
    flag?: FlagName;
}

const t = ru.footer;

const SERVICES: readonly (Entry & { icon: string })[] = [
    { label: t.services.catalog, icon: 'layout-grid', flag: 'catalog_new' },
    { label: t.services.flea, icon: 'boxes' },
    { label: t.services.parts, icon: 'cable', flag: 'accessories' },
    { label: t.services.masters, icon: 'wrench', flag: 'masters' },
    { label: t.services.salePrices, icon: 'sliders-horizontal', flag: 'sale_prices' },
    { label: t.services.safeDeal, icon: 'shield-check', flag: 'safe_deal' },
    { label: t.services.delivery, icon: 'truck' },
];

/**
 * Подвал публичных страниц: `Footer` ДС как есть. Ссылки на разделы вне MVP скрыты флагами
 * (SCREENS.md §2), MAX стоит в соцсетях вместо YouTube (DESIGN-SYSTEM.md §4).
 */
export default function SiteFooter() {
    const enabled: Partial<Record<FlagName, boolean>> = {
        catalog_new: useFlag('catalog_new'),
        accessories: useFlag('accessories'),
        masters: useFlag('masters'),
        sale_prices: useFlag('sale_prices'),
        safe_deal: useFlag('safe_deal'),
        companies: useFlag('companies'),
    };
    const shown = (entries: readonly Entry[]): string[] =>
        entries
            .filter((entry) => entry.flag === undefined || enabled[entry.flag] === true)
            .map((entry) => entry.label);

    const services = SERVICES.filter(
        (service) => service.flag === undefined || enabled[service.flag] === true,
    ).map((service): [string, string] => [service.label, service.icon]);

    const columns: [string, string[]][] = [
        [t.about.title, [...t.about.links]],
        [
            enabled.masters ? t.sellers.titleWithMasters : t.sellers.title,
            shown([
                { label: t.sellers.sell },
                { label: t.sellers.partners, flag: 'companies' },
                { label: t.sellers.becomeMaster, flag: 'masters' },
                { label: t.sellers.workshop, flag: 'masters' },
            ]),
        ],
        [
            t.useful.title,
            shown([
                { label: t.useful.howToChoose },
                { label: t.useful.salePrices, flag: 'sale_prices' },
                { label: t.useful.rules },
                { label: t.useful.legalDocs },
            ]),
        ],
        [
            t.safety.title,
            shown([
                { label: t.safety.safeDeal, flag: 'safe_deal' },
                { label: t.safety.fraud },
                { label: t.safety.disputes },
            ]),
        ],
    ];

    return <Footer services={services} columns={columns} social={[...t.social]} />;
}
