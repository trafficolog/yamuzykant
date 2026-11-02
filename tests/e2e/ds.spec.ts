import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

// Компоненты витрины = модули, которые ds:sync реэкспортирует из resources/js/ds/index.ts.
const components = [
    ...readFileSync('resources/js/ds/index.ts', 'utf8').matchAll(/from '([^']+)';/g),
].map((m) => basename(m[1] ?? ''));

test.describe('витрина дизайн-системы /_ds', () => {
    test('отрисованы все компоненты ДС, в консоли нет ошибок и предупреждений', async ({
        page,
    }) => {
        const problems: string[] = [];
        page.on('console', (message) => {
            if (message.type() === 'error' || message.type() === 'warning') {
                problems.push(`${message.type()}: ${message.text()}`);
            }
        });
        page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

        const response = await page.goto('/_ds');
        expect(response?.status()).toBe(200);
        await page.waitForLoadState('networkidle');

        expect(components.length).toBeGreaterThanOrEqual(34);
        for (const name of components) {
            const section = page.locator(`[data-ds-component="${name}"]`);
            await expect(section, name).toBeVisible();
            await expect(section.locator('[data-ds-variant]').first(), name).toBeVisible();
        }

        expect(problems).toEqual([]);
    });

    test('шрифт Onest: он основной на странице и загружен', async ({ page }) => {
        await page.goto('/_ds');
        await page.waitForLoadState('networkidle');

        const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
        expect(family.split(',')[0]?.trim()).toBe('Onest');
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.fonts.check('16px Onest'))).toBe(true);
    });

    test('SSR: сервер отдаёт разметку компонентов ДС без выполнения JS', async ({ request }) => {
        const response = await request.get('/_ds');
        expect(response.status()).toBe(200);

        const html = await response.text();
        for (const name of components) {
            expect(html, name).toContain(`data-ds-component="${name}"`);
        }
        expect(html).toContain('ym-btn');
        expect(html).toContain('ym-card');
    });
});
