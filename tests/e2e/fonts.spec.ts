import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

// 0.2.8: шрифты Onest и JetBrains Mono отдаются с нашего origin, Google Fonts не используется.
const pages = ['/', '/_ds'];
const googleHosts = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com)$/;

test.describe('самохостинг шрифтов (0.2.8)', () => {
    for (const path of pages) {
        test(`${path}: нет запросов к fonts.googleapis.com и fonts.gstatic.com`, async ({
            page,
        }) => {
            const external: string[] = [];
            // Запросы ловим по событию request, чтобы засчитать и неудавшиеся (например, без сети).
            page.on('request', (request) => {
                if (googleHosts.test(new URL(request.url()).hostname)) {
                    external.push(request.url());
                }
            });
            await page.route(
                (url) => googleHosts.test(url.hostname),
                (route) => route.abort(),
            );

            await page.goto(path);
            await page.waitForLoadState('networkidle');
            await page.evaluate(() => document.fonts.ready);

            expect(external).toEqual([]);
        });

        test(`${path}: Onest применён — загружен FontFace со своего origin`, async ({ page }) => {
            await page.goto(path);
            await page.waitForLoadState('networkidle');

            const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
            expect(family.split(',')[0]?.trim()).toBe('Onest');

            await page.evaluate(() => document.fonts.ready);
            const result = await page.evaluate(() => {
                const loaded = [...document.fonts]
                    .filter((face) => face.status === 'loaded')
                    .map((face) => face.family.replace(/["']/g, ''));
                const files = performance
                    .getEntriesByType('resource')
                    .map((entry) => entry.name)
                    .filter((name) => new URL(name).pathname.endsWith('.woff2'));
                return { loaded, files, origin: location.origin };
            });

            // Именно загруженный @font-face, а не системный Onest (fonts.check тут врёт).
            expect(result.loaded).toContain('Onest');
            expect(result.files.length).toBeGreaterThan(0);
            for (const file of result.files) {
                expect(file.startsWith(`${result.origin}/`), file).toBe(true);
            }
            expect(result.files.some((file) => /onest/i.test(file))).toBe(true);
        });
    }

    test('основное начертание Onest предзагружается в <head>', async ({ request }) => {
        const html = await (await request.get('/')).text();
        expect(html).toMatch(
            /<link[^>]*rel="preload"[^>]*as="font"[^>]*type="font\/woff2"[^>]*crossorigin[^>]*>/,
        );
        expect(html).toMatch(/<link[^>]*rel="preload"[^>]*onest[^>]*>/i);
    });

    test('@font-face: font-display swap и unicode-range, файлы woff2 отдаются', async ({
        page,
        request,
    }) => {
        await page.goto('/');
        const faces = await page.evaluate(() => {
            const rules: { family: string; display: string; range: string; src: string }[] = [];
            for (const sheet of [...document.styleSheets]) {
                for (const rule of [...sheet.cssRules]) {
                    if (rule instanceof CSSFontFaceRule) {
                        rules.push({
                            family: rule.style.getPropertyValue('font-family').replace(/["']/g, ''),
                            display: rule.style.getPropertyValue('font-display'),
                            range: rule.style.getPropertyValue('unicode-range'),
                            src: rule.style.getPropertyValue('src'),
                        });
                    }
                }
            }
            return rules;
        });

        const families = new Set(faces.map((face) => face.family));
        expect(families).toEqual(new Set(['Onest', 'JetBrains Mono']));
        for (const face of faces) {
            expect(face.display, face.src).toBe('swap');
            expect(face.range, face.src).not.toBe('');
            expect(face.src).not.toContain('googleapis');
            expect(face.src).not.toContain('gstatic');
        }

        for (const face of faces) {
            const url = /url\("?([^")]+)"?\)/.exec(face.src)?.[1] ?? '';
            const response = await request.get(new URL(url, page.url()).toString());
            expect(response.status(), url).toBe(200);
        }
    });

    test('лицензии OFL лежат рядом со шрифтами', () => {
        for (const name of ['OFL-Onest.txt', 'OFL-JetBrainsMono.txt']) {
            const path = `public/fonts/${name}`;
            expect(existsSync(path), path).toBe(true);
            expect(readFileSync(path, 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
        }
    });
});
