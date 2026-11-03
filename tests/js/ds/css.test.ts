// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
    fileURLToPath(new URL('../../../resources/css/app.css', import.meta.url)),
    'utf8',
);

describe('resources/css/app.css', () => {
    it('подключает токены ДС в порядке DESIGN-SYSTEM.md §2, без webfonts.css (Google Fonts, 0.2.8)', () => {
        const imports = [...css.matchAll(/@import\s+["']([^"']+)["']/g)].map((m) => m[1]);

        expect(imports).toEqual([
            '../js/ds/tokens/tokens.css',
            '../js/ds/tokens/page.css',
            '../js/ds/tokens/components.css',
            '../js/ds/tokens/forms.css',
        ]);
    });

    it('не подключает ym-compat.css (он только для прототипов)', () => {
        expect(css).not.toContain('ym-compat');
    });
});
