import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SHOWCASE } from '@/Components/DsShowcase/examples';
import * as ds from '@ds';

/** Компоненты — экспорты-функции с заглавной буквы; CONDITIONS, plural и прочее — не компоненты. */
const componentNames = Object.entries(ds)
    .filter(([name, value]) => typeof value === 'function' && /^[A-Z]/.test(name))
    .map(([name]) => name)
    .sort();

describe('экспорты @ds', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('index.ts отдаёт компоненты ДС', () => {
        expect(componentNames.length).toBeGreaterThanOrEqual(34);
        expect(componentNames).toEqual(
            expect.arrayContaining(['Button', 'ListingCard', 'Wordmark', 'Footer']),
        );
    });

    it('у каждого экспорта-компонента есть пример в витрине /_ds, и лишних примеров нет', () => {
        expect(SHOWCASE.map((section) => section.component).sort()).toEqual(componentNames);
    });

    it.each(componentNames)(
        '%s: все варианты витрины отрисовываются без ошибок и предупреждений',
        (name) => {
            const section = SHOWCASE.find((s) => s.component === name);
            expect(section, `нет примера для ${name}`).toBeDefined();
            expect(section?.variants.length).toBeGreaterThan(0);

            for (const variant of section?.variants ?? []) {
                const { container, unmount } = render(<>{variant.node}</>);
                expect(container.innerHTML, `${name}: ${variant.label}`).not.toBe('');
                unmount();
            }

            expect(console.error).not.toHaveBeenCalled();
            expect(console.warn).not.toHaveBeenCalled();
        },
    );
});
