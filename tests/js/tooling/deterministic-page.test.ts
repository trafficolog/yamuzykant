// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Ревью PR #99: заморозка анимаций, init-скрипт и подмена React — в одном модуле, общем для
// съёмки эталона (tools/capture-reference.mjs) и сверки (tests/e2e/visual/_helpers.ts):
// иначе при расхождении эталон и сверка получат разные кадры.
describe('общий модуль детерминизма страницы', () => {
    const module = readFileSync('tools/deterministic-page.mjs', 'utf8');
    const users = ['tools/capture-reference.mjs', 'tests/e2e/visual/_helpers.ts'].map(
        (file) => [file, readFileSync(file, 'utf8')] as const,
    );

    it('модуль содержит заморозку анимаций и подмену React', () => {
        expect(module).toContain('animation: none !important');
        expect(module).toContain('react.production.min.js');
        expect(module).toContain('reducedMotion');
    });

    it.each(users)('%s берёт их из модуля, а не дублирует', (_file, source) => {
        expect(source).toContain('deterministic-page.mjs');
        expect(source).not.toContain('animation: none');
        expect(source).not.toContain('react.production.min.js');
    });
});
