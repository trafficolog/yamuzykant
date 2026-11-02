// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const MESSAGE = 'resources/js/ds меняется только через npm run ds:sync (PR chore(ds): sync)';

type DsGuard = (files: string[], title: string) => string | null;

const loadGuard = async (): Promise<DsGuard> => {
    // Путь в переменной: tsc не пытается типизировать .mjs.
    const url = pathToFileURL(`${ROOT}tools/docs-ops.mjs`).href;
    const module = (await import(/* @vite-ignore */ url)) as { checkDsPr: DsGuard };
    return module.checkDsPr;
};

describe('docs-ops: запрет ручных правок resources/js/ds', () => {
    it('PR не из chore(ds): sync, затрагивающий resources/js/ds/**, получает ошибку', async () => {
        const checkDsPr = await loadGuard();

        expect(
            checkDsPr(
                ['app/Foo.php', 'resources/js/ds/components/actions/Button.jsx'],
                'feat(2.1.1): кнопка',
            ),
        ).toBe(MESSAGE);
    });

    it('PR chore(ds): sync может менять resources/js/ds/**', async () => {
        const checkDsPr = await loadGuard();

        expect(checkDsPr(['resources/js/ds/index.ts'], 'chore(ds): sync 2026-11-02')).toBeNull();
    });

    it('PR без файлов resources/js/ds проходит, похожие пути не считаются', async () => {
        const checkDsPr = await loadGuard();

        expect(
            checkDsPr(
                ['resources/js/Components/ds-x.tsx', 'resources/js/dsx/a.ts'],
                'feat(1.1.1): x',
            ),
        ).toBeNull();
        expect(checkDsPr([], 'feat(1.1.1): x')).toBeNull();
    });

    it('обычный `check` без --pr работает как раньше', () => {
        const result = spawnSync(process.execPath, ['tools/docs-ops.mjs', 'check'], {
            cwd: ROOT,
            encoding: 'utf8',
        });

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('ok:');
    });
});
