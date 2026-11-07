import { describe, expect, it } from 'vitest';

import type { ListingPhoto } from '@/Components/photoUploaderApi';
import { missingItems, type SellValues } from '@/lib/sellForm';

// UC-L1 7a: не хватает данных — кнопка неактивна, над ней список недостающего.

function photo(id: number, overrides: Partial<ListingPhoto> = {}): ListingPhoto {
    return {
        id,
        position: id,
        is_serial: false,
        state: 'ready',
        error: null,
        urls: null,
        ...overrides,
    };
}

const filled: SellValues = {
    title: 'Fender American Vintage ’57 Stratocaster',
    condition: 'excellent',
    price: 184_500,
    meet: true,
    ship: false,
};

const three = [photo(1, { is_serial: true }), photo(2), photo(3)];

describe('missingItems', () => {
    it('заполненная форма — недостающего нет', () => {
        expect(missingItems(filled, three)).toEqual([]);
    });

    it('пустая форма: порядок как в макете', () => {
        const empty: SellValues = {
            title: '',
            condition: null,
            price: 0,
            meet: false,
            ship: false,
        };

        expect(missingItems(empty, [])).toEqual([
            'модель',
            'ещё 3 фото',
            'фото серийного номера',
            'состояние',
            'цену',
            'способ передачи',
        ]);
    });

    it('2 фото: «ещё 1 фото»', () => {
        expect(missingItems(filled, [photo(1, { is_serial: true }), photo(2)])).toEqual([
            'ещё 1 фото',
        ]);
    });

    it('3 фото без серийного номера: только фото серийного номера', () => {
        expect(missingItems(filled, [photo(1), photo(2), photo(3)])).toEqual([
            'фото серийного номера',
        ]);
    });

    it('фото с ошибкой обработки не считаются', () => {
        const failed = photo(3, { state: 'failed', error: 'Не удалось обработать фото.' });

        expect(missingItems(filled, [photo(1, { is_serial: true }), photo(2), failed])).toEqual([
            'ещё 1 фото',
        ]);
    });

    it('фото в обработке считаются', () => {
        const processing = photo(3, { state: 'processing' });

        expect(missingItems(filled, [photo(1, { is_serial: true }), photo(2), processing])).toEqual(
            [],
        );
    });

    it('одно слово или пробелы вместо названия — нет модели (нужны бренд и модель)', () => {
        expect(missingItems({ ...filled, title: '   ' }, three)).toEqual(['модель']);
        expect(missingItems({ ...filled, title: 'Fender' }, three)).toEqual(['модель']);
    });

    it('достаточно одного способа передачи', () => {
        expect(missingItems({ ...filled, meet: false, ship: true }, three)).toEqual([]);
        expect(missingItems({ ...filled, meet: false, ship: false }, three)).toEqual([
            'способ передачи',
        ]);
    });
});
