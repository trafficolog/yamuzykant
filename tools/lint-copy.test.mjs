// Тесты lint-copy (карточка 0.2.2, AGENTS.md §5). Запуск: node --test tools/lint-copy.test.mjs
// Каждая проверка идёт через CLI во временном проекте-фикстуре: так видно то же, что увидит CI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL = join(HERE, 'lint-copy.mjs');
const AGENTS = join(HERE, '..', 'AGENTS.md');

// Временный проект: { 'путь/к/файлу': 'содержимое' }.
const project = (files) => {
    const root = mkdtempSync(join(tmpdir(), 'lint-copy-'));
    for (const [path, content] of Object.entries(files)) {
        const full = join(root, path);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, content);
    }
    return root;
};

const lint = (files, args = []) =>
    spawnSync(process.execPath, [TOOL, ...args], { cwd: project(files), encoding: 'utf8' });

// Путь в выводе может быть с «\» (Windows), поэтому разделители в шаблоне любые.
const at = (path, line) => new RegExp(`${path.replace(/\//g, '[\\\\/]')}:${line}\\b`);

test('сетап в .tsx роняет проверку с файлом и строкой', () => {
    const r = lint({ 'resources/js/Pages/Home.tsx': 'const a = 1;\n<p>Ваш сетап</p>\n' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, at('resources/js/Pages/Home.tsx', 2));
});

test('сетап в .php (app/ и lang/) роняет проверку с файлом и строкой', () => {
    const r = lint({
        'app/Http/Controllers/Foo.php': '<?php\n\nreturn "Ваш сетап";\n',
        'lang/ru/messages.php': "<?php\n\nreturn [\n    'title' => 'сетап',\n];\n",
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, at('app/Http/Controllers/Foo.php', 3));
    assert.match(r.stderr, at('lang/ru/messages.php', 4));
});

test('чистые исходники проходят с кодом 0', () => {
    const r = lint({
        'resources/js/Pages/Home.tsx': '<h1>ЯМузыкант</h1>\n',
        'lang/ru/messages.php': "<?php\n\nreturn ['title' => 'Настройка'];\n",
    });
    assert.equal(r.status, 0, r.stderr);
});

test('--styles: #fff в Pages роняет проверку, без --styles проходит', () => {
    const files = { 'resources/js/Pages/Home.tsx': "<div style={{ color: '#fff' }} />;\n" };
    const strict = lint(files, ['--styles']);
    assert.equal(strict.status, 1);
    assert.match(strict.stderr, at('resources/js/Pages/Home.tsx', 1));
    assert.equal(lint(files).status, 0);
});

test('--styles: rgb() и hsl() в Components и Layouts тоже роняют проверку', () => {
    const r = lint(
        {
            'resources/js/Components/Card.tsx': "const c = 'rgb(0, 0, 0)';\n",
            'resources/js/Layouts/Shell.tsx': "const c = 'hsl(0 0% 0%)';\n",
        },
        ['--styles'],
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, at('resources/js/Components/Card.tsx', 1));
    assert.match(r.stderr, at('resources/js/Layouts/Shell.tsx', 1));
});

test('--styles: цвета вне Pages, Components, Layouts не проверяются', () => {
    const r = lint({ 'app/Support/Palette.php': "<?php\n\nreturn '#fff';\n" }, ['--styles']);
    assert.equal(r.status, 0, r.stderr);
});

test('copy-allow с причиной в комментарии освобождает строку', () => {
    const r = lint({
        'resources/js/Pages/Home.tsx': '<p>Ваш сетап</p>{/* copy-allow: цитата из договора */}\n',
    });
    assert.equal(r.status, 0, r.stderr);
});

test('copy-allow без причины не освобождает строку', () => {
    const r = lint({
        'resources/js/Pages/Home.tsx': '<p>Ваш сетап</p>{/* copy-allow: */}\n',
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, at('resources/js/Pages/Home.tsx', 1));
});

test('copy-allow внутри строкового литерала не считается исключением', () => {
    const r = lint({
        'resources/js/Pages/Home.tsx': "const s = 'сетап'; const t = 'copy-allow: причина';\n",
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, at('resources/js/Pages/Home.tsx', 1));
});

test('маркер copy-allow внутри строкового литерала не освобождает строку (PHP, PHP с #, шаблон)', () => {
    const r = lint({
        'lang/ru/messages.php': "<?php\n\nreturn ['a' => 'сетап // copy-allow: причина'];\n",
        'app/Http/Controllers/Foo.php': '<?php\n\nreturn "гир # copy-allow: причина";\n',
        'resources/js/Pages/Home.tsx': 'const s = `сетап // copy-allow: причина`;\n',
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, at('lang/ru/messages.php', 3));
    assert.match(r.stderr, at('app/Http/Controllers/Foo.php', 3));
    assert.match(r.stderr, at('resources/js/Pages/Home.tsx', 1));
});

test('настоящий комментарий после строкового литерала освобождает строку', () => {
    const r = lint({
        'resources/js/Pages/Home.tsx':
            "const s = 'сетап';  // copy-allow: цитата из договора\n",
    });
    assert.equal(r.status, 0, r.stderr);
});

test('copy-allow с причиной из одного короткого слова не освобождает строку', () => {
    const r = lint({
        'resources/js/Pages/Home.tsx': '<p>Ваш сетап</p>{/* copy-allow: причина */}\n',
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, at('resources/js/Pages/Home.tsx', 1));
});

test('resources/js/ds и тестовые файлы не проверяются', () => {
    const r = lint({
        'resources/js/ds/components/Header.tsx': "export const t = 'Сетап';\n",
        'resources/js/Pages/Home.test.tsx': "export const t = 'сетап';\n",
    });
    assert.equal(r.status, 0, r.stderr);
});

test('словарь покрывает все запрещённые слова из таблицы AGENTS.md §5', () => {
    const lines = readFileSync(AGENTS, 'utf8').split('\n');
    const header = lines.findIndex((l) => l.startsWith('| Нельзя'));
    assert.notEqual(header, -1, 'таблица «Нельзя | Пишем» не найдена в AGENTS.md');
    const words = [];
    for (const line of lines.slice(header + 2)) {
        if (!line.startsWith('|')) break;
        const cell = line.split('|')[1] ?? '';
        words.push(...cell.split(',').map((w) => w.trim()).filter(Boolean));
    }
    assert.ok(words.length >= 9, `в таблице AGENTS §5 найдено слов: ${words.length}`);

    const files = Object.fromEntries(words.map((w, i) => [`app/word${i}.php`, `<?php\n// ${w}\n`]));
    const r = lint(files);
    assert.equal(r.status, 1);
    words.forEach((w, i) => assert.match(r.stderr, at(`app/word${i}.php`, 2), w));
});
