// Тесты порога покрытия (SDD-TDD §4): общее ≥ 75 %, app/Domain ≥ 90 %.
// Запуск: node --test .github/scripts/coverage-gate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'coverage-gate.mjs');
const ROOT = '/home/runner/work/yamuzykant/yamuzykant';

const clover = (files) => {
    const body = files
        .map(
            ([name, statements, covered]) =>
                `<file name="${ROOT}/${name}"><metrics loc="10" ncloc="10" classes="1" methods="1" coveredmethods="0" conditionals="0" coveredconditionals="0" statements="${statements}" coveredstatements="${covered}" elements="${statements}" coveredelements="${covered}"/></file>`,
        )
        .join('\n');
    const dir = mkdtempSync(join(tmpdir(), 'clover-'));
    const path = join(dir, 'clover.xml');
    writeFileSync(path, `<?xml version="1.0"?>\n<coverage><project>\n${body}\n</project></coverage>\n`);
    return path;
};

const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

const FILES = [
    ['app/Http/Controllers/HomeController.php', 10, 10],
    ['app/Domain/Listings/Actions/PublishListing.php', 20, 17],
    ['app/Domain/Deals/StateMachines/DealStateMachine.php', 20, 20],
    ['app/Providers/AppServiceProvider.php', 50, 30],
];

test('общее покрытие ниже порога — выход 1 и процент в сообщении', () => {
    const r = run(clover(FILES), '--min', '80');
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /77\.0\s?%/);
});

test('общее покрытие на пороге и выше — выход 0', () => {
    const r = run(clover(FILES), '--min', '75');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /77\.0\s?%/);
});

test('фильтр --path считает только файлы каталога: app/Domain 92,5 % ≥ 90', () => {
    const r = run(clover(FILES), '--path', 'app/Domain', '--min', '90');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /app\/Domain/);
    assert.match(r.stdout, /92\.5\s?%/);
});

test('app/Domain ниже 90 % — выход 1', () => {
    const files = [...FILES.slice(0, 1), ['app/Domain/Listings/Actions/PublishListing.php', 20, 10]];
    const r = run(clover(files), '--path', 'app/Domain', '--min', '90');
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /50\.0\s?%/);
});

test('каталог без файлов (app/Domain ещё нет) — выход 0 с пояснением', () => {
    const r = run(clover(FILES.slice(0, 1)), '--path', 'app/Domain', '--min', '90');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /нет файлов/);
});

test('похожий префикс не попадает в фильтр (app/DomainX ≠ app/Domain)', () => {
    const r = run(clover([['app/DomainX/Thing.php', 10, 0]]), '--path', 'app/Domain', '--min', '90');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /нет файлов/);
});

test('нет файла отчёта — выход 2', () => {
    const r = run(join(tmpdir(), 'no-such-clover.xml'), '--min', '75');
    assert.equal(r.status, 2, r.stdout + r.stderr);
});

test('нет --min — выход 2', () => {
    const r = run(clover(FILES));
    assert.equal(r.status, 2, r.stdout + r.stderr);
});
