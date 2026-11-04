// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

type Manifest = {
    engines?: { node?: string };
    devDependencies: Record<string, string>;
};
type Lock = {
    packages: Record<
        string,
        { version?: string; engines?: { node?: string }; devDependencies?: Record<string, string> }
    >;
};

const read = <T>(file: string): T => JSON.parse(readFileSync(`${ROOT}${file}`, 'utf8')) as T;

describe('package.json: версии инструментов (0.1.8)', () => {
    const pkg = read<Manifest>('package.json');
    const lock = read<Lock>('package-lock.json');

    it('engines.node — >=22.22 (требование jsdom и undici)', () => {
        expect(pkg.engines?.node).toBe('>=22.22');
        expect(lock.packages['']?.engines?.node).toBe('>=22.22');
    });

    it('@vitest/coverage-v8 — точная версия без ^ и ~, равная vitest', () => {
        const coverage = pkg.devDependencies['@vitest/coverage-v8'] ?? '';
        const vitest = (pkg.devDependencies['vitest'] ?? '').replace(/^[\^~]/, '');

        expect(coverage).toMatch(/^\d+\.\d+\.\d+$/);
        expect(coverage).toBe(vitest);
    });

    it('в lock-файле vitest и @vitest/coverage-v8 той же версии', () => {
        const coverage = pkg.devDependencies['@vitest/coverage-v8'];

        expect(lock.packages['node_modules/vitest']?.version).toBe(coverage);
        expect(lock.packages['node_modules/@vitest/coverage-v8']?.version).toBe(coverage);
        expect(lock.packages['']?.devDependencies?.['@vitest/coverage-v8']).toBe(coverage);
    });

    // 0.2.6: версия Playwright задаёт образ контейнера эталонов (mcr.microsoft.com/playwright:vX-noble)
    // и браузер в CI, http-server отдаёт прототипы. Плавающий ^ ломает сверку при обновлении.
    const PINNED = ['playwright', '@playwright/test', 'http-server'];

    it.each(PINNED)('%s — точная версия без ^ и ~', (name) => {
        expect(pkg.devDependencies[name] ?? '').toMatch(/^\d+\.\d+\.\d+$/);
    });

    it.each(PINNED)('%s — в lock-файле та же версия, что в package.json', (name) => {
        const wanted = pkg.devDependencies[name];
        expect(lock.packages[`node_modules/${name}`]?.version).toBe(wanted);
        expect(lock.packages['']?.devDependencies?.[name]).toBe(wanted);
    });

    it('playwright и @playwright/test — одной версии', () => {
        expect(pkg.devDependencies['@playwright/test']).toBe(pkg.devDependencies['playwright']);
    });
});
