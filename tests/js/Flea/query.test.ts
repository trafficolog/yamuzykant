import { describe, expect, it } from 'vitest';

import { EMPTY_FILTERS, fleaHref, hasActiveFilters, toQuery } from '@/Pages/Flea/query';

// Адрес выдачи Барахолки: тот же порядок и те же имена параметров, что у App\Domain\Search\FleaFilters::toQuery().

describe('toQuery', () => {
    it('умолчания не попадают в адрес', () => {
        expect(toQuery(EMPTY_FILTERS)).toEqual({});
    });

    it('собирает все параметры; первая страница не пишется', () => {
        expect(
            toQuery(
                {
                    q: 'страт',
                    condition: ['excellent', 'good'],
                    priceFrom: 50_000,
                    priceTo: 200_000,
                    negotiable: true,
                    ship: true,
                    sort: 'cheap',
                },
                1,
            ),
        ).toEqual({
            q: 'страт',
            condition: ['excellent', 'good'],
            price_from: 50_000,
            price_to: 200_000,
            negotiable: 1,
            ship: 1,
            sort: 'cheap',
        });
    });

    it('страница больше первой пишется', () => {
        expect(toQuery(EMPTY_FILTERS, 3)).toEqual({ page: 3 });
    });
});

describe('fleaHref', () => {
    it('без категории и фильтров — /baraholka', () => {
        expect(fleaHref(null, EMPTY_FILTERS)).toBe('/baraholka');
    });

    it('категория — путь после /baraholka', () => {
        expect(fleaHref('gitary/elektrogitary', EMPTY_FILTERS)).toBe(
            '/baraholka/gitary/elektrogitary',
        );
    });

    it('фильтры — query в стабильном порядке, состояния как condition[]', () => {
        expect(
            fleaHref(
                'gitary',
                {
                    ...EMPTY_FILTERS,
                    condition: ['excellent', 'good'],
                    priceFrom: 50_000,
                    ship: true,
                    sort: 'cheap',
                },
                2,
            ),
        ).toBe(
            '/baraholka/gitary?condition[]=excellent&condition[]=good&price_from=50000&ship=1&sort=cheap&page=2',
        );
    });

    it('текст запроса экранируется', () => {
        expect(fleaHref(null, { ...EMPTY_FILTERS, q: 'Les Paul & Co' })).toBe(
            '/baraholka?q=Les%20Paul%20%26%20Co',
        );
    });
});

describe('hasActiveFilters', () => {
    it('сортировка и запрос фильтрами не считаются, остальное считается', () => {
        expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
        expect(hasActiveFilters({ ...EMPTY_FILTERS, sort: 'cheap', q: 'x' })).toBe(false);
        expect(hasActiveFilters({ ...EMPTY_FILTERS, condition: ['good'] })).toBe(true);
        expect(hasActiveFilters({ ...EMPTY_FILTERS, priceTo: 1 })).toBe(true);
        expect(hasActiveFilters({ ...EMPTY_FILTERS, negotiable: true })).toBe(true);
        expect(hasActiveFilters({ ...EMPTY_FILTERS, ship: true })).toBe(true);
    });
});
