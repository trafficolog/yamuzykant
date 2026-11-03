#!/usr/bin/env node
// coverage-gate — порог покрытия строк по clover-отчёту (SDD-TDD §4).
//   node .github/scripts/coverage-gate.mjs <clover.xml> --min <процент> [--path <каталог>]
// С --path считаются только файлы внутри каталога (например, app/Domain).
// Для каждого файла берутся метрики самого файла (<metrics loc=…> после <class>), а не первого класса.
// Каталога ещё нет в отчёте — проверка пропускается (выход 0) с пояснением.
// Выход: 0 — порог выполнен, 1 — ниже порога, 2 — ошибка ввода.
import { existsSync, readFileSync } from 'node:fs';
import console from 'node:console';
import process from 'node:process';

const fail = (message) => {
    console.error(`coverage-gate: ${message}`);
    process.exit(2);
};

const [report, ...rest] = process.argv.slice(2);
const opt = (name) => {
    const i = rest.indexOf(name);
    return i === -1 ? undefined : rest[i + 1];
};
const min = Number(opt('--min'));
const path = opt('--path')?.replace(/\\/g, '/').replace(/\/+$/, '');

if (!report) fail('укажите путь к clover.xml');
if (!existsSync(report)) fail(`нет файла ${report}`);
if (!Number.isFinite(min) || min < 0 || min > 100) fail('укажите --min от 0 до 100');

const xml = readFileSync(report, 'utf8');
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

let statements = 0;
let covered = 0;
let files = 0;
for (const [, name, inner] of xml.matchAll(/<file\s+name="([^"]*)"[^>]*>([\s\S]*?)<\/file>/g)) {
    const file = name.replace(/\\/g, '/');
    if (path && !(file.startsWith(`${path}/`) || file.includes(`/${path}/`))) continue;
    // В <file> PHPUnit сначала пишет <class><metrics/></class> каждого класса и трейта, и только потом
    // <metrics loc=…/> самого файла. Классы вырезаем: берём метрики файла, а не первого класса.
    const fileLevel = inner.replace(/<(class|trait)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/g, '');
    const metrics = fileLevel.match(/<metrics\b[^>]*>/)?.[0];
    if (!metrics) continue;
    statements += Number(attr(metrics, 'statements') ?? 0);
    covered += Number(attr(metrics, 'coveredstatements') ?? 0);
    files += 1;
}

const scope = path ?? 'всё приложение';
if (path && files === 0) {
    console.log(`coverage-gate: ${scope} — нет файлов в отчёте, порог ${min} % не проверяется`);
    process.exit(0);
}

const percent = statements === 0 ? 100 : (covered / statements) * 100;
const line = `${scope}: ${percent.toFixed(1)} % строк (${covered}/${statements}, файлов: ${files}), порог ${min} %`;
if (percent + 1e-9 < min) {
    console.error(`coverage-gate: ниже порога — ${line}`);
    process.exit(1);
}
console.log(`coverage-gate: ok — ${line}`);
