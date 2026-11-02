import { ListingCard, type ListingCardProps } from '@ds';
import { describe, expect, it } from 'vitest';

// Эти проверки выполняет `tsc --noEmit`: если типы из .d.ts не подхвачены (any),
// директивы @ts-expect-error станут «неиспользованными» и тип-чек упадёт.
const valid: ListingCardProps = {
    title: 'Fender American Vintage ’57 Stratocaster 2009, Sunburst',
    price: 184500,
    condition: 'excellent',
    city: 'Москва',
    shipping: 0,
};

// @ts-expect-error — price обязателен
const withoutPrice: ListingCardProps = { title: 'Без цены' };

// @ts-expect-error — price число, не строка
const priceAsString: ListingCardProps = { title: 'Цена строкой', price: '184 500' };

// @ts-expect-error — состояния «супер» нет в шкале ДС
const unknownCondition: ListingCardProps = { title: 'Лот', price: 1, condition: 'super' };

describe('типы ListingCard из .d.ts', () => {
    it('пропсы ListingCard типизированы (проверяет tsc, см. types.test.ts)', () => {
        expect(typeof ListingCard).toBe('function');
        expect([valid, withoutPrice, priceAsString, unknownCondition]).toHaveLength(4);
    });
});
