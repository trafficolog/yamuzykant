// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DESCRIPTION_MAX, SERIAL_MAX, TITLE_MAX, YEAR_MIN, fieldErrors } from '@/lib/sellForm';

// Пределы полей клиента и сервера совпадают: правила StoreListingRequest — единственный источник.
const php = readFileSync(
    fileURLToPath(
        new URL('../../../app/Http/Requests/Listings/StoreListingRequest.php', import.meta.url),
    ),
    'utf8',
);
const constant = (name: string): number => {
    const match = php.match(new RegExp(`const ${name} = ([\\d_]+);`));
    if (!match?.[1]) throw new Error(`Нет константы ${name} в StoreListingRequest`);
    return Number(match[1].replaceAll('_', ''));
};

const ok = { title: 'Fender Stratocaster', year: '', serial: '', description: '' };

describe('паритет пределов с StoreListingRequest', () => {
    it('название, описание, серийный номер, минимальный год', () => {
        expect(TITLE_MAX).toBe(constant('TITLE_MAX'));
        expect(DESCRIPTION_MAX).toBe(constant('DESCRIPTION_MAX'));
        expect(SERIAL_MAX).toBe(constant('SERIAL_MAX'));
        expect(YEAR_MIN).toBe(constant('YEAR_MIN'));
    });
});

describe('fieldErrors', () => {
    it('в пределах — ошибок нет; пустые год и серийный номер допустимы', () => {
        expect(fieldErrors(ok)).toEqual({});
        expect(
            fieldErrors({
                title: 'F'.repeat(TITLE_MAX - 2) + ' x',
                year: String(YEAR_MIN),
                serial: 'A'.repeat(SERIAL_MAX),
                description: 'а'.repeat(DESCRIPTION_MAX),
            }),
        ).toEqual({});
    });

    it('название длиннее предела', () => {
        expect(fieldErrors({ ...ok, title: `Fender ${'a'.repeat(TITLE_MAX)}` }).title).toBe(
            `Название длиннее ${TITLE_MAX} символов — сократите его.`,
        );
    });

    it('год: меньше предела и в будущем — ошибка, текущий год — нет', () => {
        const message = fieldErrors({ ...ok, year: String(YEAR_MIN - 1) }).year;
        expect(message).toBe(`Укажите год выпуска от ${YEAR_MIN} до ${new Date().getFullYear()}.`);
        expect(fieldErrors({ ...ok, year: String(new Date().getFullYear() + 1) }).year).toBe(
            message,
        );
        expect(fieldErrors({ ...ok, year: String(new Date().getFullYear()) }).year).toBeUndefined();
    });

    it('неполный год (1–3 цифры) — ошибка', () => {
        expect(fieldErrors({ ...ok, year: '200' }).year).toBeDefined();
    });

    it('серийный номер и описание длиннее предела', () => {
        expect(fieldErrors({ ...ok, serial: 'A'.repeat(SERIAL_MAX + 1) }).serial).toBe(
            `Серийный номер длиннее ${SERIAL_MAX} символов.`,
        );
        expect(
            fieldErrors({ ...ok, description: 'а'.repeat(DESCRIPTION_MAX + 1) }).description,
        ).toBe(`Описание длиннее ${DESCRIPTION_MAX} символов — сократите его.`);
    });
});
