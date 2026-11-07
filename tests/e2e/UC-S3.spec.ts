import { expect, test, type Page } from '@playwright/test';

// UC-S3 «Отфильтровать и отсортировать выдачу» (SPEC §4) и критерии карточки 3.1.2:
// обновление страницы сохраняет фильтры, «Назад» возвращает к той же выдаче и позиции.

const aside = (page: Page) => page.getByRole('complementary', { name: 'Фильтры' });
const prices = async (page: Page): Promise<number[]> =>
    (await page.getByRole('article').locator('.ym-price__now').allInnerTexts()).map((text) =>
        Number(text.replace(/\D/g, '')),
    );

test.describe('UC-S3: фильтры и сортировка', () => {
    test('состояние: чип попадает в адрес, выдача сужается, F5 сохраняет фильтр', async ({
        page,
    }) => {
        await page.goto('/baraholka');
        const total = page.getByText(/^Найдено/);
        await expect(total).toHaveText('Найдено 27 лотов');

        await aside(page)
            .getByRole('button', { name: /^Отличное/ })
            .click();

        await expect(page).toHaveURL(/condition(%5B%5D|\[\])=excellent/);
        await expect(total).not.toHaveText('Найдено 27 лотов');
        const filtered = await total.innerText();

        await page.reload();
        await expect(aside(page).getByRole('button', { name: /^Отличное/ })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        await expect(total).toHaveText(filtered);
    });

    test('цена от–до, «Готов к торгу», «Доставка» складываются', async ({ page }) => {
        await page.goto('/baraholka');

        const from = aside(page).getByLabel('от');
        await from.fill('50000');
        await from.press('Enter');
        const to = aside(page).getByLabel('до');
        await to.fill('100000');
        await to.press('Enter');
        await expect(page).toHaveURL(/price_from=50000/);
        await expect(page).toHaveURL(/price_to=100000/);
        for (const price of await prices(page)) {
            expect(price).toBeGreaterThanOrEqual(50_000);
            expect(price).toBeLessThanOrEqual(100_000);
        }

        await aside(page).getByRole('button', { name: 'Доставка' }).click();
        await expect(page).toHaveURL(/ship=1/);
        await aside(page).getByRole('button', { name: 'Готов к торгу' }).click();
        await expect(page).toHaveURL(/negotiable=1/);

        await page.reload();
        await expect(aside(page).getByLabel('от')).toHaveValue('50000');
        await expect(aside(page).getByRole('button', { name: 'Доставка' })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
    });

    test('сортировка: дешевле — по возрастанию цены, дороже — по убыванию; «рядом» нет', async ({
        page,
    }) => {
        await page.goto('/baraholka');
        const select = page.getByLabel('Сортировка');
        await expect(select.locator('option')).toHaveText([
            'Сначала свежие',
            'Сначала дешевле',
            'Сначала дороже',
        ]);

        await select.selectOption('cheap');
        await expect(page).toHaveURL(/sort=cheap/);
        const asc = await prices(page);
        expect(asc).toEqual([...asc].sort((a, b) => a - b));

        await select.selectOption('expensive');
        await expect(page).toHaveURL(/sort=expensive/);
        const desc = await prices(page);
        expect(desc).toEqual([...desc].sort((a, b) => b - a));
    });

    test('«Сбросить все» очищает фильтры', async ({ page }) => {
        await page.goto('/baraholka?ship=1&negotiable=1');
        await aside(page).getByRole('button', { name: 'Сбросить все' }).click();

        await expect(page).toHaveURL(/\/baraholka$/);
        await expect(page.getByText('Найдено 27 лотов')).toBeVisible();
    });

    test('фильтры без результата — пустое состояние со сбросом', async ({ page }) => {
        await page.goto('/baraholka?price_from=9000000');

        await expect(
            page.getByText('По этим фильтрам лотов нет. Уберите часть фильтров.'),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Сбросить фильтры' }).click();
        await expect(page.getByText('Найдено 27 лотов')).toBeVisible();
    });

    test('«Показать ещё» дописывает выдачу без перезагрузки; номера страниц — ссылки', async ({
        page,
    }) => {
        await page.goto('/baraholka?sort=cheap');
        await expect(page.getByRole('article')).toHaveCount(24);
        await expect(page.getByRole('link', { name: 'Страница 2' })).toHaveAttribute(
            'href',
            /page=2/,
        );

        await page.getByRole('button', { name: 'Показать ещё' }).click();

        await expect(page.getByRole('article')).toHaveCount(27);
        await expect(page.getByRole('button', { name: 'Показать ещё' })).toHaveCount(0);
        await expect(page.getByText('Показано 27 из 27')).toBeVisible();
    });

    test('«Назад» возвращает к прежним фильтрам, а после ухода со страницы — к той же выдаче и позиции', async ({
        page,
    }) => {
        await page.goto('/baraholka');
        await aside(page).getByRole('button', { name: 'Доставка' }).click();
        await expect(page).toHaveURL(/ship=1/);

        await page.goBack();
        await expect(page).toHaveURL(/\/baraholka$/);
        await expect(aside(page).getByRole('button', { name: 'Доставка' })).toHaveAttribute(
            'aria-pressed',
            'false',
        );

        await page.getByRole('button', { name: 'Показать ещё' }).click();
        await expect(page.getByRole('article')).toHaveCount(27);
        await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
        const y = await page.evaluate(() => window.scrollY);
        expect(y).toBeGreaterThan(500);

        await page.getByRole('banner').getByRole('link', { name: 'ЯМузыкант' }).click();
        await expect(page).toHaveURL(/\/$/);
        await page.goBack();

        await expect(page.getByRole('article')).toHaveCount(27);
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y - 200);
    });
});
