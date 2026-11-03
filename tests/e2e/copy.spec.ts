import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findForbidden, pickRoutes } from '../../tools/copy-dictionary.mjs';

// Маршруты берём из самого приложения: новая публичная страница попадает в проверку сама.
const APP_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const routes = pickRoutes(
    JSON.parse(
        execFileSync('php', ['artisan', 'route:list', '--json'], {
            cwd: APP_ROOT,
            encoding: 'utf8',
        }),
    ),
);

// Запрещённые слова из AGENTS.md §5 в отрисованном тексте страницы (document.body.innerText).
test.describe('copy: в отрисованном тексте нет запрещённых слов', () => {
    test('список публичных маршрутов не пуст', () => {
        expect(routes).toContain('/');
    });

    for (const route of routes) {
        test(`${route}`, async ({ page }) => {
            const response = await page.goto(route);
            expect(response?.status(), route).toBe(200);
            await page.waitForLoadState('networkidle');

            const text = await page.evaluate(() => document.body.innerText);
            expect(findForbidden(text), route).toEqual([]);
        });
    }

    test('контроль: проверка ловит запрещённое слово в отрисованной странице', async ({ page }) => {
        await page.setContent('<main><p>Ваш сетап готов</p></main>');
        const text = await page.evaluate(() => document.body.innerText);
        expect(findForbidden(text).map((hit) => hit.word)).toEqual(['сетап']);
    });
});
