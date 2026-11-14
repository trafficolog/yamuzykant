import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// UC-V2 «Посмотреть продавца» (3.1.6). Данные — LotDemoSeeder (global-setup.lot.ts): продавец «Гитарный угол»,
// шесть опубликованных лотов и одно снятое (не проданное — на странице продавца его нет).

const LOT = '3a1f0c00-0000-4000-8000-000000000001';
const WITHDRAWN = '3a1f0c00-0000-4000-8000-000000000009';
const SELLER_EMAIL = 'lot-demo-seller@example.test';

/** Открывает лот и переходит по ссылке в блоке продавца. */
async function openSellerFromLot(page: Page): Promise<void> {
    await page.goto(`/listings/${LOT}`);
    await page
        .getByRole('region', { name: 'Продавец' })
        .getByRole('link', { name: 'Гитарный угол' })
        .click();
    await expect(page).toHaveURL(/\/sellers\/\d+$/);
}

test.describe('UC-V2: страница продавца', () => {
    test('с лота по ссылке в блоке продавца: шапка, объявления в продаже, без почты и «0 ₽»', async ({
        page,
    }) => {
        await openSellerFromLot(page);

        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Гитарный угол');
        await expect(page.getByText('г. Санкт-Петербург')).toBeVisible();
        await expect(page.getByText(/На ЯМузыканте с \S+ \d{4}/)).toBeVisible();

        const list = page.getByRole('list', { name: 'Объявления продавца' });
        await expect(list.getByRole('link').first()).toBeVisible();
        await expect(list.locator(`a[href="/listings/${WITHDRAWN}"]`)).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Пожаловаться' })).toHaveCount(0);

        const html = await page.content();
        expect(html).not.toContain(SELLER_EMAIL);
        expect(await page.locator('main').innerText()).not.toMatch(/(^|\D)0\s₽/);
    });

    test('вкладка «Продано» — пустое состояние, без цен', async ({ page }) => {
        await openSellerFromLot(page);

        await page.getByRole('link', { name: /Продано/ }).click();

        await expect(page).toHaveURL(/tab=sold/);
        await expect(page.getByText('Проданных инструментов пока нет.')).toBeVisible();
    });

    test('несуществующий продавец — 404', async ({ page }) => {
        const response = await page.goto('/sellers/999999999');

        expect(response?.status()).toBe(404);
    });

    test('axe без serious и critical, 1440 и 390 px; горизонтальной прокрутки нет', async ({
        page,
    }) => {
        await openSellerFromLot(page);
        const url = page.url();

        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(url);
            await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

            const results = await new AxeBuilder({ page }).analyze();
            const serious = results.violations.filter((v) =>
                ['serious', 'critical'].includes(v.impact ?? ''),
            );
            expect(
                serious.map(
                    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
                ),
                `${width}px`,
            ).toEqual([]);

            const overflow = await page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
            );
            expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
        }
    });
});
