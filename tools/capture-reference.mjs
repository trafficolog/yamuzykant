#!/usr/bin/env node
// capture-reference — PNG-эталоны из прототипов по design/screens/manifest.json.
// Требует: npm i -D playwright http-server && npx playwright install chromium
// Запуск:  npx http-server design/prototypes -p 8123 -s &  node tools/capture-reference.mjs [--only id,id]
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const M = JSON.parse(readFileSync('design/screens/manifest.json', 'utf8'));
const BASE = process.env.REF_BASE || 'http://localhost:8123';
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
mkdirSync(M.outDir, { recursive: true });

const browser = await chromium.launch();
let n = 0;
for (const s of M.screens.filter(s => !only.length || only.includes(s.id))) {
  for (const vpName of s.viewports) {
    const vp = M.viewports.find(v => v.name === vpName);
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}/${encodeURI(s.file)}${s.query || ''}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    const out = `${M.outDir}/${s.id}@${vpName}.png`;
    await page.screenshot({ path: out, fullPage: true, animations: 'disabled' });
    console.log(`${errors.length ? '!' : '✓'} ${out}${errors.length ? '  ошибки: ' + errors.join('; ') : ''}`);
    await page.close(); n++;
  }
}
await browser.close();
console.log(`снято: ${n}`);
