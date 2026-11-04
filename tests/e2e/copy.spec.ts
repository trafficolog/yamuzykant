import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findForbidden, pickRoutes } from '../../tools/copy-dictionary.mjs';
import { ATTRIBUTES, collectCopy, forbiddenIn } from './_copy';

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

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

// Запрещённые слова из AGENTS.md §5 в отрисованном тексте страницы (document.body.innerText)
// и в атрибутах title, placeholder, aria-label, alt (0.2.6): их читает скринридер.
test.describe('copy: в отрисованном тексте нет запрещённых слов', () => {
    test('список публичных маршрутов не пуст', () => {
        expect(routes).toContain('/');
    });

    test('проверяются атрибуты title, placeholder, aria-label, alt', () => {
        expect(ATTRIBUTES).toEqual(['title', 'placeholder', 'aria-label', 'alt']);
    });

    for (const route of routes) {
        test(`${route}`, async ({ page }) => {
            const response = await page.goto(route);
            expect(response?.status(), route).toBe(200);
            await page.waitForLoadState('networkidle');

            expect(forbiddenIn(await collectCopy(page)), route).toEqual([]);
        });
    }

    test('контроль: проверка ловит запрещённое слово в отрисованной странице', async ({ page }) => {
        await page.setContent('<main><p>Ваш сетап готов</p></main>');
        const text = await page.evaluate(() => document.body.innerText);
        expect(findForbidden(text).map((hit) => hit.word)).toEqual(['сетап']);
        expect(forbiddenIn(await collectCopy(page)).map((hit) => hit.word)).toEqual(['сетап']);
    });

    // Контрольные тесты на атрибутах: запрещённое слово только там, innerText чистый.
    const controls = [
        ['placeholder', '<input placeholder="Мой гир" />', 'мой гир'],
        ['aria-label', '<button aria-label="Купить сетап">Купить</button>', 'сетап'],
        ['title', '<a href="#" title="Кофр-доставка">Доставка</a>', 'кофр-доставка'],
        ['alt', `<img alt="Ладмастер" src="${PIXEL}" />`, 'ладмастер'],
    ] as const;

    for (const [attribute, html, word] of controls) {
        test(`контроль: запрещённое слово в ${attribute} роняет проверку`, async ({ page }) => {
            await page.setContent(`<main>${html}</main>`);

            const text = await page.evaluate(() => document.body.innerText);
            expect(findForbidden(text), 'innerText чистый').toEqual([]);

            const hits = forbiddenIn(await collectCopy(page));
            expect(hits.map((hit) => hit.word)).toContain(word);
            expect(hits.map((hit) => hit.source)).toContain(attribute);
        });
    }

    test('контроль: чистые атрибуты проходят', async ({ page }) => {
        await page.setContent(
            `<main><input placeholder="Поиск" /><button aria-label="Закрыть" title="Закрыть">x</button><img alt="Гитара" src="${PIXEL}" /></main>`,
        );
        expect(forbiddenIn(await collectCopy(page))).toEqual([]);
    });
});
