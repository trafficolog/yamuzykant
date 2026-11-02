#!/usr/bin/env node
// lint-copy — запрещённые слова (AGENTS.md §5) в исходниках; --styles — сырые цвета в страницах.
// Исключение на строке: комментарий «copy-allow: причина».
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const STYLES = process.argv.includes('--styles');
const ROOTS = ['resources/js', 'resources/views', 'lang', 'app'];
const SKIP = [/resources[\/\\]js[\/\\]ds[\/\\]/, /node_modules/, /\.test\.|\.spec\./];
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.php', '.json', '.md', '.vue']);
const WORDS = [
  [/(^|[^а-яё])гир(а|ом|у|е|ы)?(?![а-яё])/i, 'гир → инструмент / оборудование'],
  [/мой\s+гир/i, 'мой гир → мои инструменты'],
  [/сетап/i, 'сетап → настройка'],
  [/ля\s?440/i, 'Ля440 → Цены продаж'],
  [/фермат/i, 'Фермата → Безопасная сделка'],
  [/по\s+рукам/i, '«По рукам!» → Цена согласована'],
  [/кофр-доставк/i, 'Кофр-доставка → Доставка в защитной упаковке'],
  [/ладмаст|ладмир/i, 'Ладмастер/Ладмир → ЯМузыкант']
];
const COLOR = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i;
const COLOR_DIRS = [/resources[\/\\]js[\/\\](Pages|Components|Layouts)[\/\\]/];

const files = [];
const walk = d => { for (const n of readdirSync(d)) { const p = join(d, n); if (SKIP.some(r => r.test(p))) continue; const s = statSync(p); if (s.isDirectory()) walk(p); else if (EXT.has(extname(n))) files.push(p); } };
ROOTS.filter(existsSync).forEach(walk);

const errs = [];
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/copy-allow:/.test(line)) return;
    for (const [re, hint] of WORDS) if (re.test(line)) errs.push(`${f}:${i + 1}  ${hint}`);
    if (STYLES && COLOR_DIRS.some(r => r.test(f)) && COLOR.test(line)) errs.push(`${f}:${i + 1}  цвет без токена — используйте var(--…)`);
  });
}
if (errs.length) { console.error(errs.join('\n')); console.error(`\nlint-copy: ${errs.length} нарушений`); process.exit(1); }
console.log(`lint-copy: ok (${files.length} файлов${STYLES ? ', со стилями' : ''})`);
