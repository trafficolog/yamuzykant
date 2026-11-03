// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

type Exec = (file: string, args: string[], options?: unknown) => string;
type PrApi = {
    prFiles: (pr: string, exec: Exec) => string[];
    checkDsForPr: (pr: string, exec: Exec) => string | null;
};

const loadPrApi = async (): Promise<PrApi> => {
    const url = pathToFileURL(`${ROOT}tools/docs-ops.mjs`).href;
    return (await import(/* @vite-ignore */ url)) as PrApi;
};

const PAGE = 100;

// Подмена gh: `gh pr view --json files` отдаёт только первую страницу (лимит 100),
// `gh api --paginate …/pulls/N/files` — все файлы; --jq применяется к каждой странице.
const fakeGh = (paths: string[], title: string) => {
    const calls: string[][] = [];
    const exec: Exec = (file, args) => {
        calls.push([file, ...args]);
        if (file !== 'gh') throw new Error(`ожидался gh, получен ${file}`);
        if (args[0] === 'api') {
            if (!args.includes('--paginate')) return paths.slice(0, PAGE).join('\n');
            return paths.join('\n') + '\n';
        }
        if (args[0] === 'pr' && args.includes('files')) {
            return JSON.stringify({ title, files: paths.slice(0, PAGE).map((path) => ({ path })) });
        }
        return title + '\n';
    };
    return { exec, calls };
};

const manyFiles = (count: number, dsAt: number): string[] =>
    Array.from({ length: count }, (_, i) =>
        i === dsAt ? 'resources/js/ds/components/actions/Button.jsx' : `app/Generated/File${i}.php`,
    );

describe('docs-ops: check --pr получает файлы PR с пагинацией', () => {
    it('prFiles идёт через gh api --paginate pulls/{n}/files и возвращает все файлы', async () => {
        const { prFiles } = await loadPrApi();
        const { exec, calls } = fakeGh(manyFiles(150, 120), 't');

        const files = prFiles('72', exec);

        expect(files).toHaveLength(150);
        const args = calls[0] ?? [];
        expect(args.slice(0, 3)).toEqual(['gh', 'api', '--paginate']);
        expect(args.join(' ')).toContain('repos/{owner}/{repo}/pulls/72/files');
    });

    it('resources/js/ds виден в PR из 150 файлов, когда файл за пределами первых 100', async () => {
        const { checkDsForPr } = await loadPrApi();
        const { exec } = fakeGh(manyFiles(150, 120), 'feat(2.1.1): кнопка');

        expect(checkDsForPr('72', exec)).toBe(MESSAGE);
    });

    it('PR из 150 файлов с заголовком chore(ds): sync и без ds проходит', async () => {
        const { checkDsForPr } = await loadPrApi();

        expect(
            checkDsForPr('72', fakeGh(manyFiles(150, 120), 'chore(ds): sync 2026-11-03').exec),
        ).toBeNull();
        expect(checkDsForPr('72', fakeGh(manyFiles(150, -1), 'feat(1.1.1): x').exec)).toBeNull();
    });

    it('ошибка gh не превращается в тихий успех', async () => {
        const { checkDsForPr } = await loadPrApi();
        const exec: Exec = () => {
            throw new Error('gh: нет доступа');
        };

        expect(() => checkDsForPr('72', exec)).toThrow();
    });
});

describe('docs-ops: запуск CLI через символическую ссылку', () => {
    it('`check` выполняется, когда argv[1] — ссылка на tools (realpath)', () => {
        const dir = mkdtempSync(join(tmpdir(), 'docs-ops-link-'));
        const link = join(dir, 'tools');
        symlinkSync(`${ROOT}tools`, link, 'junction');

        const result = spawnSync(process.execPath, [join(link, 'docs-ops.mjs'), 'check'], {
            cwd: ROOT,
            encoding: 'utf8',
        });

        expect(result.stdout).toContain('ok:');
        expect(result.status).toBe(0);
    });
});
