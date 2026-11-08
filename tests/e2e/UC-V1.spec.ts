import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// UC-V1 «Посмотреть лот» и вход UC-D1 «Написать продавцу» (3.1.5). Данные — LotDemoSeeder (global-setup.lot.ts,
// один раз на прогон): лот из прототипа (Fender American Vintage ’57 Stratocaster, 184 500 ₽), пять похожих, одно снятое.

const LOT = '3a1f0c00-0000-4000-8000-000000000001';
const WITHDRAWN = '3a1f0c00-0000-4000-8000-000000000009';
const SELLER_EMAIL = 'lot-demo-seller@example.test';

async function signInAsSeller(page: Page): Promise<void> {
    await page.goto('/');
    const cookie = (await page.context().cookies()).find((c) => c.name === 'XSRF-TOKEN');
    const headers = {
        'X-XSRF-TOKEN': decodeURIComponent(cookie?.value ?? ''),
        Accept: 'application/json',
    };
    for (const [url, data] of [
        ['/auth/email/code', { email: SELLER_EMAIL }],
        ['/auth/email/verify', { email: SELLER_EMAIL, code: '123456' }],
    ] as const) {
        const response = await page.request.post(url, { data, headers });
        expect(response.ok(), `${url}: ${response.status()}`).toBeTruthy();
    }
}

test.describe('UC-V1: страница объявления', () => {
    test('гость видит лот: заголовок, цена, характеристики с маской серийного номера, без почты и расстояния', async ({
        page,
    }) => {
        const response = await page.goto(`/listings/${LOT}`);
        expect(response?.status()).toBe(200);

        await expect(page.getByRole('heading', { level: 1 })).toContainText(
            'Fender American Vintage ’57 Stratocaster 2009',
        );
        await expect(page.locator('.ym-price--pdp')).toHaveText(/184\s500\s₽/);
        await expect(page.getByText('V09****')).toBeVisible();
        await expect(page.getByText('Встреча в г. Санкт-Петербург')).toBeVisible();

        const html = await page.content();
        expect(html).not.toContain('V091187');
        expect(html).not.toContain(SELLER_EMAIL);
        await expect(page.getByText('Предложить цену')).toHaveCount(0);
        expect(await page.locator('body').innerText()).not.toMatch(/\d\s?км/);
    });

    test('галерея: превью переключают фото, просмотр на весь экран закрывается Escape; серийное фото гостю не отдаётся', async ({
        page,
    }) => {
        await page.goto(`/listings/${LOT}`);
        const gallery = page.getByRole('region', { name: 'Фотографии' });

        // Гостю — 2 фото из 3: фото серийного номера только владельцу.
        await expect(gallery).toContainText('1 / 2');
        await gallery.getByRole('button', { name: 'Фото 2' }).click();
        await expect(gallery).toContainText('2 / 2');

        await gallery.getByRole('button', { name: 'Открыть фото на весь экран' }).click();
        await expect(page.getByRole('dialog', { name: 'Просмотр фото' })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
    });

    test('похожие лоты: «Договорная» и «Бесплатно», «0 ₽» нигде нет', async ({ page }) => {
        await page.goto(`/listings/${LOT}`);
        const heading = page.getByRole('heading', { name: 'Похожие лоты рядом' });
        // Индекс обновляется очередью: ждём, пока похожие появятся.
        await expect(async () => {
            await page.reload();
            await expect(heading).toBeVisible({ timeout: 2_000 });
        }).toPass({ timeout: 30_000 });

        const text = await page.locator('main').innerText();
        expect(text).toContain('Договорная');
        expect(text).toContain('Бесплатно');
        expect(text).not.toMatch(/(^|\D)0\s₽/);
        await expect(page.locator('main a[href^="/listings/"]').first()).toBeVisible();
    });

    test('«Написать продавцу» у гостя открывает окно входа', async ({ page }) => {
        await page.goto(`/listings/${LOT}`);

        await page.getByRole('button', { name: 'Написать продавцу' }).click();

        await expect(page.getByRole('dialog', { name: 'Вход' })).toBeVisible();
    });

    // Один вход на тест: код на почту ограничен (5 в час на адрес).
    test('снятое: гостю 404; владельцу 200 с плашкой, без «Написать», и фото серийного номера у главного лота', async ({
        page,
        browser,
    }) => {
        const guest = await (await browser.newContext()).newPage();
        const hidden = await guest.goto(`/listings/${WITHDRAWN}`);
        expect(hidden?.status()).toBe(404);

        await signInAsSeller(page);
        const response = await page.goto(`/listings/${WITHDRAWN}`);
        expect(response?.status()).toBe(200);
        await expect(page.getByTestId('lot-status')).toContainText('Снято с продажи');
        await expect(page.getByText('Это ваше объявление')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Написать продавцу' })).toHaveCount(0);

        await page.goto(`/listings/${LOT}`);
        await expect(page.getByRole('region', { name: 'Фотографии' })).toContainText('1 / 3');
    });

    test('axe без serious и critical, 1440 и 390 px; горизонтальной прокрутки нет', async ({
        page,
    }) => {
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(`/listings/${LOT}`);
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
