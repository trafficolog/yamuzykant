// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
    cpSync,
    existsSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SRC = join(ROOT, 'design/ds');
const COMMITTED = join(ROOT, 'resources/js/ds');

const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? files(path) : [path];
    });

const rel = (dir: string): string[] =>
    files(dir)
        .map((f) => relative(dir, f).replaceAll('\\', '/'))
        .sort();

/** Отпечаток всего дерева: относительные пути и байты файлов. */
const fingerprint = (dir: string): string => {
    const hash = createHash('sha256');
    for (const file of rel(dir)) {
        hash.update(file);
        hash.update(readFileSync(join(dir, file)));
    }
    return hash.digest('hex');
};

// ds:sync запускаем в песочнице (копия design/ds во временной папке), чтобы не стирать
// resources/js/ds, пока другие тесты читают её параллельно.
let sandbox: string;
const generated = (): string => join(sandbox, 'resources/js/ds');
const sync = (): void => {
    execFileSync(process.execPath, [join(ROOT, 'tools/ds-sync.mjs')], {
        cwd: sandbox,
        stdio: 'pipe',
    });
};

beforeAll(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'ds-sync-'));
    cpSync(SRC, join(sandbox, 'design/ds'), { recursive: true });
});

afterAll(() => {
    rmSync(sandbox, { recursive: true, force: true });
});

describe('npm run ds:sync', () => {
    it('идемпотентен: повторный запуск не меняет ни одного файла', () => {
        sync();
        const first = fingerprint(generated());
        sync();

        expect(fingerprint(generated())).toBe(first);
    });

    it('в репозитории лежит ровно то, что даёт ds:sync (ручные правки и устаревшая копия видны)', () => {
        sync();

        expect(existsSync(COMMITTED), 'нет resources/js/ds — выполните npm run ds:sync').toBe(true);
        expect(rel(COMMITTED)).toEqual(rel(generated()));
        expect(fingerprint(COMMITTED)).toBe(fingerprint(generated()));
    });

    it('копирует токены ДС и не копирует карточки, промпты и документы', () => {
        sync();
        const copied = rel(generated());

        for (const token of [
            'tokens.css',
            'webfonts.css',
            'page.css',
            'components.css',
            'forms.css',
        ]) {
            expect(copied).toContain(`tokens/${token}`);
        }
        expect(copied.filter((f) => f.endsWith('.card.html') || f.endsWith('.prompt.md'))).toEqual(
            [],
        );
        expect(copied.filter((f) => f.startsWith('docs/') || f.startsWith('ui_kits/'))).toEqual([]);
    });

    it('index.ts реэкспортирует каждый компонент из design/ds/components', () => {
        sync();
        const index = readFileSync(join(generated(), 'index.ts'), 'utf8');
        const components = files(join(SRC, 'components'))
            .filter((f) => f.endsWith('.jsx') && /^[A-Z]/.test(basename(f)))
            .map((f) =>
                relative(SRC, f)
                    .replaceAll('\\', '/')
                    .replace(/\.jsx$/, ''),
            );

        expect(components.length).toBeGreaterThan(30);
        for (const component of components) {
            expect(index).toContain(`export * from './${component}';`);
        }
        expect(index.startsWith('// AUTO-GENERATED')).toBe(true);
    });
});
