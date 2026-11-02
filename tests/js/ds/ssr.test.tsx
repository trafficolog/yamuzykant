// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SHOWCASE } from '@/Components/DsShowcase/examples';

const variants = SHOWCASE.flatMap((section) =>
    section.variants.map((variant) => [section.component, variant.label, variant.node] as const),
);

describe('SSR компонентов ДС (окружение node: нет window и document)', () => {
    it('в окружении нет window и document', () => {
        expect(typeof window).toBe('undefined');
        expect(typeof document).toBe('undefined');
    });

    it('импорт @ds не обращается к window и document', async () => {
        const ds = await import('@ds');

        expect(Object.keys(ds).length).toBeGreaterThan(30);
    });

    it.each(variants)('%s — «%s» отрисовывается в строку', (_component, _label, node) => {
        const html = renderToString(<>{node}</>);

        expect(html.length).toBeGreaterThan(0);
    });
});
