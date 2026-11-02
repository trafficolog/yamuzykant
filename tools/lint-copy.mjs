#!/usr/bin/env node
// lint-copy — запрещённые слова (AGENTS.md §5) в исходниках; --styles — сырые цвета в страницах.
// Исключение на строке: комментарий «copy-allow: причина» с непустой причиной.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { FORBIDDEN } from './copy-dictionary.mjs';

const STYLES = process.argv.includes('--styles');
const ROOTS = ['resources/js', 'resources/views', 'lang', 'app'];
// Копия ДС (resources/js/ds) правится только в её репозитории; тесты проверяют себя сами.
const SKIP = [/resources[\/\\]js[\/\\]ds[\/\\]/, /node_modules/, /\.test\.|\.spec\./];
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.php', '.json', '.md', '.vue']);
const COLOR = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i;
const COLOR_DIRS = [/resources[\/\\]js[\/\\](Pages|Components|Layouts)[\/\\]/];

// Текст комментария строки — только вне строковых литералов ('…', "…", `…`, с экранированием).
// Маркер внутри литерала комментарием не считается. Возвращает null, если комментария нет.
function commentText(line) {
    let quote = null;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quote) {
            if (c === '\\') i++;
            else if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') quote = c;
        else if (c === '#' || line.startsWith('//', i) || line.startsWith('/*', i) || line.startsWith('<!--', i))
            return line.slice(i);
    }
    return null;
}

// Исключение: комментарий `copy-allow: причина` вне литерала. Причина — два слова или 10 символов.
function isAllowed(line) {
    const comment = commentText(line);
    const m = comment?.match(/copy-allow:(.*)$/);
    if (!m) return false;
    const reason = (m[1] ?? '').replace(/\*\/|-->|\}/g, '').trim();
    const words = reason.split(/\s+/).filter((w) => /\p{L}/u.test(w));
    return words.length >= 2 || reason.length >= 10;
}

const files = [];
const walk = (d) => {
    for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (SKIP.some((r) => r.test(p))) continue;
        const s = statSync(p);
        if (s.isDirectory()) walk(p);
        else if (EXT.has(extname(n))) files.push(p);
    }
};
ROOTS.filter(existsSync).forEach(walk);

const errs = [];
for (const f of files) {
    readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
            if (isAllowed(line)) return;
            for (const { word, hint } of FORBIDDEN.filter((e) => e.re.test(line)))
                errs.push(`${f}:${i + 1}  ${word} → ${hint}`);
            if (STYLES && COLOR_DIRS.some((r) => r.test(f)) && COLOR.test(line))
                errs.push(`${f}:${i + 1}  цвет без токена — используйте var(--…)`);
        });
}
if (errs.length) {
    console.error(errs.join('\n'));
    console.error(`\nlint-copy: ${errs.length} нарушений`);
    process.exit(1);
}
console.log(`lint-copy: ok (${files.length} файлов${STYLES ? ', со стилями' : ''})`);
