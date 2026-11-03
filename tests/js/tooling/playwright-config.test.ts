// @vitest-environment node
import { describe, expect, it } from 'vitest';
import config from '../../../playwright.config';

// 0.2.6: ретраи не должны маскировать флаки визуальных тестов по эталонам.
describe('playwright.config: проект references', () => {
    const references = config.projects?.find((project) => project.name === 'references');

    it('проект references существует', () => {
        expect(references).toBeDefined();
    });

    it('retries: 0 — даже в CI', () => {
        expect(references?.retries).toBe(0);
    });

    it('снимок в пути с {testName}: параллельные тесты одного эталона не делят файл', () => {
        expect(references?.snapshotPathTemplate).toContain('{testName}');
    });
});
