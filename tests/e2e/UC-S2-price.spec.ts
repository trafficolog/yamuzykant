import { expect, test, type Locator } from '@playwright/test';

// UC-S2, BR-11 (карточка 3.1.9): подпись «Договорная» и «Бесплатно» на карточке Барахолки видна
// до гидратации и без JS. Данные — LotDemoSeeder: два таких лота в Санкт-Петербурге.

const caption = (cards: Locator, title: string): Locator =>
    cards.filter({ hasText: title }).locator('.ym-price__now');
const generated = (price: Locator): Promise<string> =>
    price.evaluate((el) => getComputedStyle(el, '::after').content);

test('«Договорная» и «Бесплатно» видны на карточках без JS и после гидратации', async ({
    page,
    browser,
}) => {
    await page.goto('/baraholka');
    await page.getByRole('banner').getByRole('button', { name: 'Москва' }).click();
    const panel = page.getByRole('dialog', { name: 'Выбор города' });
    await panel.getByRole('searchbox', { name: 'Поиск города' }).fill('Санкт');
    await panel.getByRole('button', { name: 'Санкт-Петербург' }).click();
    await expect(page.getByText(/^Найдено/)).not.toHaveText('Найдено 27 лотов');

    // После гидратации.
    const cards = page.getByRole('article');
    await expect(caption(cards, 'Fender Japan ST62')).toBeVisible();
    expect(await generated(caption(cards, 'Fender Japan ST62'))).toContain('"Договорная"');
    expect(await generated(caption(cards, 'Fender Vintera'))).toContain('"Бесплатно"');

    // Без JS: только серверная разметка и CSS.
    const context = await browser.newContext({
        javaScriptEnabled: false,
        storageState: await page.context().storageState(),
    });
    const bare = await context.newPage();
    await bare.goto('/baraholka');
    const bareCards = bare.getByRole('article');
    expect(await generated(caption(bareCards, 'Fender Japan ST62'))).toContain('"Договорная"');
    expect(await generated(caption(bareCards, 'Fender Vintera'))).toContain('"Бесплатно"');
    // 3.1.10: слово лежит в DOM текстом (поиск по странице, скринридеры), а не только в CSS.
    await expect(
        bare.locator('.ym-priced-card').filter({ hasText: 'Fender Japan ST62' }),
    ).toContainText('Договорная');
    await expect(
        bare.locator('.ym-priced-card').filter({ hasText: 'Fender Vintera' }),
    ).toContainText('Бесплатно');
    await context.close();
});
