#!/usr/bin/env node
// capture-reference — PNG-эталоны из прототипов по design/screens/manifest.json.
// Эталоны снимают в Linux-контейнере Playwright той же версии, что в CI (шрифты и рендер
// должны совпасть с ubuntu-runner), см. design/screens/README.md.
// Требует: npm ci (playwright, http-server) и браузер chromium.
// Запуск:  npx http-server design/prototypes -p 8123 -s &  node tools/capture-reference.mjs [--only=id,id]
// Код выхода 1, если у страницы были ошибки скриптов, неудачные запросы или ответы 4xx/5xx.
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const M = JSON.parse(readFileSync('design/screens/manifest.json', 'utf8'));
const BASE = process.env.REF_BASE || 'http://localhost:8123';
const onlyArg = process.argv.findIndex(a => a === '--only' || a.startsWith('--only='));
const onlyRaw = onlyArg < 0 ? '' : process.argv[onlyArg].includes('=') ? process.argv[onlyArg].slice(7) : (process.argv[onlyArg + 1] || '');
const only = onlyRaw.split(',').filter(Boolean);
const targets = M.screens.filter(s => !only.length || only.includes(s.id));
const unknown = only.filter(id => !M.screens.some(s => s.id === id));
if (unknown.length) {
  console.error(`Нет в manifest: ${unknown.join(', ')}`);
  process.exit(2);
}
mkdirSync(M.outDir, { recursive: true });

const browser = await chromium.launch();
let n = 0;
let failed = 0;
for (const s of targets) {
  for (const vpName of s.viewports) {
    const vp = M.viewports.find(v => v.name === vpName);
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
    const problems = [];
    page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
    page.on('requestfailed', r => problems.push(`запрос не прошёл: ${r.url()} (${r.failure()?.errorText})`));
    page.on('response', r => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
    await page.goto(`${BASE}/${encodeURI(s.file)}${s.query || ''}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    const out = `${M.outDir}/${s.id}@${vpName}.png`;
    // Полный экран по высоте, по ширине — ровно viewport: прототипы местами шире 390 px
    // (скрытое переполнение), а реализация обязана вписываться в экран.
    const { height, scrollWidth } = await page.evaluate(() => ({
      height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    }));
    await page.screenshot({
      path: out, fullPage: true, animations: 'disabled', caret: 'hide',
      clip: { x: 0, y: 0, width: vp.width, height: Math.max(height, vp.height) },
    });
    const note = scrollWidth > vp.width ? `  (прототип шире экрана: scrollWidth ${scrollWidth} px, обрезано до ${vp.width})` : '';
    console.log(`${problems.length ? '!' : '✓'} ${out}${note}${problems.length ? '\n    ' + problems.join('\n    ') : ''}`);
    if (problems.length) failed++;
    await page.close(); n++;
  }
}
await browser.close();
console.log(`снято: ${n}${failed ? `, с проблемами: ${failed}` : ''}`);
process.exit(failed ? 1 : 0);
