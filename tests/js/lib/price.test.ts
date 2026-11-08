import { describe, expect, it } from 'vitest';

import { formatPrice, parsePrice } from '@/lib/price';

// UC-L1 п. 6: цена в поле — «184 500» (неразрывный пробел, AGENTS §5); буквы и знаки игнорируются.
const NBSP = ' ';

describe('formatPrice', () => {
    it('разбивает на тысячи неразрывным пробелом', () => {
        expect(formatPrice('184500')).toBe(`184${NBSP}500`);
        expect(formatPrice('1000000')).toBe(`1${NBSP}000${NBSP}000`);
        expect(formatPrice('999')).toBe('999');
    });

    it('игнорирует буквы и знаки', () => {
        expect(formatPrice('abc184500')).toBe(`184${NBSP}500`);
        expect(formatPrice('18a4,5-00 ₽')).toBe(`184${NBSP}500`);
        expect(formatPrice('только буквы')).toBe('');
    });

    it('принимает уже отформатированный ввод (обычный и неразрывный пробел)', () => {
        expect(formatPrice('184 5000')).toBe(`1${NBSP}845${NBSP}000`);
        expect(formatPrice(`184${NBSP}500`)).toBe(`184${NBSP}500`);
    });

    it('убирает ведущие нули', () => {
        expect(formatPrice('000')).toBe('');
        expect(formatPrice('0123')).toBe('123');
    });

    it('не превышает предел цены 99 999 999 ₽: лишние цифры отбрасываются', () => {
        expect(formatPrice('123456789')).toBe(`12${NBSP}345${NBSP}678`);
    });
});

describe('parsePrice', () => {
    it('возвращает целые рубли', () => {
        expect(parsePrice(`184${NBSP}500`)).toBe(184_500);
        expect(parsePrice('184 500')).toBe(184_500);
    });

    it('без цифр — 0', () => {
        expect(parsePrice('')).toBe(0);
        expect(parsePrice('abc')).toBe(0);
    });
});
