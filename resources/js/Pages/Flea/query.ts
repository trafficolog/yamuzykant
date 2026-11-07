/** Фильтры Барахолки в адресе. Имена и порядок параметров — как у App\Domain\Search\FleaFilters::toQuery(). */

export type FleaSortKey = 'new' | 'cheap' | 'expensive';

export interface FleaFilterState {
    q: string;
    condition: string[];
    priceFrom: number | null;
    priceTo: number | null;
    negotiable: boolean;
    ship: boolean;
    sort: FleaSortKey | null;
}

export const EMPTY_FILTERS: FleaFilterState = {
    q: '',
    condition: [],
    priceFrom: null,
    priceTo: null,
    negotiable: false,
    ship: false,
    sort: null,
};

export const FLEA_PATH = '/baraholka';

export type FleaQuery = {
    q?: string;
    condition?: string[];
    price_from?: number;
    price_to?: number;
    negotiable?: 1;
    ship?: 1;
    sort?: FleaSortKey;
    page?: number;
};

/** Параметры адреса: умолчания и первая страница не пишутся. */
export function toQuery(filters: FleaFilterState, page = 1): FleaQuery {
    const query: FleaQuery = {};
    if (filters.q !== '') query.q = filters.q;
    if (filters.condition.length > 0) query.condition = filters.condition;
    if (filters.priceFrom !== null) query.price_from = filters.priceFrom;
    if (filters.priceTo !== null) query.price_to = filters.priceTo;
    if (filters.negotiable) query.negotiable = 1;
    if (filters.ship) query.ship = 1;
    if (filters.sort !== null) query.sort = filters.sort;
    if (page > 1) query.page = page;
    return query;
}

/** Адрес выдачи: `/baraholka[/категория][?фильтры]`, состояния как `condition[]=…`. */
export function fleaHref(path: string | null, filters: FleaFilterState, page = 1): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(toQuery(filters, page))) {
        if (Array.isArray(value)) {
            for (const item of value) parts.push(`${key}[]=${encodeURIComponent(item)}`);
        } else {
            parts.push(`${key}=${encodeURIComponent(String(value))}`);
        }
    }
    const base = path === null ? FLEA_PATH : `${FLEA_PATH}/${path}`;
    return parts.length > 0 ? `${base}?${parts.join('&')}` : base;
}

/** Есть ли выбранные фильтры (поиск и сортировка фильтрами не считаются). */
export function hasActiveFilters(filters: FleaFilterState): boolean {
    return (
        filters.condition.length > 0 ||
        filters.priceFrom !== null ||
        filters.priceTo !== null ||
        filters.negotiable ||
        filters.ship
    );
}
