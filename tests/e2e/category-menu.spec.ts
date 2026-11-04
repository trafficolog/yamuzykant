import { expect, test, type Page } from '@playwright/test';

// Меню категорий шапки (0.2.7): роль панели на десктопе и шторки на < 640 px, фокус, иерархия заголовков,
// высота подвала в R1 на 390 px, флаг delivery_service. Флаги в тестах — состояние R1 (все выключены).

const toggle = (page: Page) => page.getByRole('button', { name: 'Категории' });
const menu = (page: Page) => page.locator('#site-category-menu');
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Все категории' });

const openHome = async (page: Page, width: number, height: number) => {
    await page.setViewportSize({ width, height });
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('networkidle');
};

test.describe('Меню категорий: десктоп (выпадающая панель)', () => {
    test.beforeEach(async ({ page }) => {
        await openHome(page, 1440, 900);
    });

    test('иерархия заголовков: при открытом меню первый заголовок страницы — h1', async ({
        page,
    }) => {
        await toggle(page).click();
        await expect(menu(page)).toBeVisible();

        const first = await page
            .locator('h1, h2, h3, h4, h5, h6')
            .first()
            .evaluate((el) => el.tagName);
        expect(first).toBe('H1');
    });

    test('роль: aria-controls указывает на панель; диалога и aria-modal нет', async ({ page }) => {
        await toggle(page).click();

        await expect(toggle(page)).toHaveAttribute('aria-controls', 'site-category-menu');
        await expect(menu(page)).not.toHaveAttribute('role', 'dialog');
        await expect(menu(page)).not.toHaveAttribute('aria-modal', 'true');
        await expect(page.getByRole('dialog')).toHaveCount(0);
    });

    test('Tab с последнего пункта меню на следующий элемент шапки закрывает меню', async ({
        page,
    }) => {
        await toggle(page).click();
        await menu(page).locator('.ym-site-menu__service').last().focus();

        await page.keyboard.press('Tab');

        await expect(menu(page)).toHaveCount(0);
        await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByRole('searchbox')).toBeFocused();
    });

    test('Tab с кнопки «Категории» входит в меню и меню не закрывает', async ({ page }) => {
        await toggle(page).focus();
        await page.keyboard.press('Enter');
        await expect(menu(page)).toBeVisible();

        await page.keyboard.press('Tab');

        await expect(menu(page)).toBeVisible();
        await expect(menu(page).getByRole('button', { name: 'Гитары' })).toBeFocused();
    });

    test('доставка скрыта флагом delivery_service: нет в меню и в подвале', async ({ page }) => {
        await toggle(page).click();

        await expect(
            menu(page).getByRole('link', { name: 'Доставка в защитной упаковке' }),
        ).toHaveCount(0);
        await expect(
            page.getByRole('contentinfo').getByRole('link', { name: 'Доставка с упаковкой' }),
        ).toHaveCount(0);
    });
});

test.describe('Меню категорий: шторка на < 640 px', () => {
    test.beforeEach(async ({ page }) => {
        await openHome(page, 390, 844);
    });

    test('роль: шторка — модальный диалог с aria-modal, фокус переносится в неё при открытии', async ({
        page,
    }) => {
        await toggle(page).click();

        await expect(sheet(page)).toHaveAttribute('aria-modal', 'true');
        await expect(page.getByRole('button', { name: 'Гитары' })).toBeFocused();
    });

    test('Tab не уводит фокус из шторки под неё', async ({ page }) => {
        await toggle(page).click();
        await expect(sheet(page)).toBeVisible();

        for (let step = 0; step < 40; step++) {
            await page.keyboard.press('Tab');
            const inside = await page.evaluate(() =>
                Boolean(
                    document.querySelector('#site-category-menu')?.contains(document.activeElement),
                ),
            );
            expect(inside, `Tab #${step + 1}`).toBe(true);
        }
    });

    test('переключение видов не теряет фокус: «виды → группы → назад»', async ({ page }) => {
        await toggle(page).click();

        await sheet(page).getByRole('button', { name: 'Педали и усилители' }).click();
        await expect(sheet(page).getByRole('button', { name: 'Все категории' })).toBeFocused();

        await sheet(page).getByRole('button', { name: 'Все категории' }).click();
        await expect(sheet(page).getByRole('button', { name: 'Педали и усилители' })).toBeFocused();
    });

    test('Esc закрывает шторку и возвращает фокус на «Категории»', async ({ page }) => {
        await toggle(page).click();

        await page.keyboard.press('Escape');

        await expect(sheet(page)).toHaveCount(0);
        await expect(toggle(page)).toBeFocused();
    });

    test('верхняя панель шторки: viewport-fit=cover в HTML для safe-area', async ({ request }) => {
        const html = await (await request.get('/')).text();

        expect(html).toContain('viewport-fit=cover');
    });
});

test.describe('Подвал в R1 на 390 px', () => {
    test('высота подвала 931 ± 2 px (после скрытия доставки)', async ({ page }) => {
        await openHome(page, 390, 844);

        const box = await page.getByRole('contentinfo').boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(929);
        expect(box?.height).toBeLessThanOrEqual(933);
    });
});
