import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { FAKE_CODE, freshEmail, open, requestCode, signInByEmail } from './_auth';

// UC-S5 «Добавить в избранное» (4.3.1). Данные — LotDemoSeeder (global-setup.lot.ts): лот из прототипа.
// Гость → окно входа → после входа объявление в избранном (1.1.2); вкладка «Избранное» кабинета; откат при ошибке.

const LOT = '3a1f0c00-0000-4000-8000-000000000001';
const LOT_TITLE = 'Fender American Vintage ’57 Stratocaster 2009';

const heart = (page: Page, pressed: boolean) =>
    page
        .locator('.ym-lot__head')
        .getByRole('button', { name: pressed ? 'Убрать из избранного' : 'В избранное' });

test.describe('UC-S5: избранное', () => {
    test('гость: сердце открывает вход, после входа лот в избранном и виден во вкладке кабинета', async ({
        page,
    }) => {
        await open(page, `/listings/${LOT}`);

        await heart(page, false).click();
        await expect(page.getByRole('dialog', { name: 'Вход', exact: true })).toBeVisible();

        // Вход через окно; прерванное действие («В избранное») выполняется само.
        const dialog = page.getByRole('dialog');
        await requestCode(page, freshEmail('uc-s5'));
        await dialog.getByLabel('Код из письма').fill(FAKE_CODE);
        await dialog.getByLabel('Имя').fill('Анна');
        await dialog.getByRole('checkbox').check();
        await dialog.getByRole('button', { name: 'Продолжить' }).click();
        await expect(page.getByRole('dialog')).toBeHidden();

        await expect(heart(page, true)).toBeVisible();

        await open(page, '/account/favorites');
        const list = page.getByRole('list', { name: 'Избранное' });
        await expect(list.getByRole('link', { name: LOT_TITLE })).toBeVisible();
        await expect(page.getByRole('navigation', { name: 'Разделы кабинета' })).toContainText(
            'Избранное',
        );
    });

    test('вошедший: сердце меняется сразу; при ошибке сервера возвращается назад', async ({
        page,
    }) => {
        await open(page, '/');
        await signInByEmail(page);
        await open(page, `/listings/${LOT}`);

        await page.route('**/favorite', (route) => route.fulfill({ status: 500, body: '{}' }));
        await heart(page, false).click();

        await expect(heart(page, false)).toBeVisible();
        await expect(page.locator('.ym-lot__head').getByRole('status')).toContainText(
            'Не удалось обновить избранное',
        );

        await page.unroute('**/favorite');
        await heart(page, false).click();
        await expect(heart(page, true)).toBeVisible();

        await page.reload();
        await expect(heart(page, true)).toBeVisible();
        await heart(page, true).click();
        await expect(heart(page, false)).toBeVisible();
    });

    test('пустая вкладка «Избранное» и axe без serious и critical', async ({ page }) => {
        await open(page, '/');
        await signInByEmail(page);
        await open(page, '/account/favorites');

        await expect(page.getByText(/пока ничего нет/i)).toBeVisible();
        const results = await new AxeBuilder({ page }).analyze();
        expect(
            results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
        ).toEqual([]);
    });
});
