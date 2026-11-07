import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { open, signInByEmail } from './_auth';

// UC-A1 «Войти», шапка вошедшего (1.1.6): после входа без перезагрузки — меню кабинета, выход на главную.
// Нужны LOGIN_CODE_FAKE=123456 (окружение e2e, CI).

const seriousOrCritical = async (page: Page) => {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    return result.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => `${violation.id}: ${violation.nodes.map((n) => n.target).join(' | ')}`);
};

const markNoReload = (page: Page) =>
    page.evaluate(() => {
        (window as unknown as { __noReload: boolean }).__noReload = true;
    });
const stillSamePage = (page: Page) =>
    page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload === true);

/** Нажать «Выйти» и дождаться, пока страница перезагрузится и оживёт: переход на главную — полный. */
const logOut = async (page: Page) => {
    await Promise.all([
        page.waitForEvent('load'),
        page.getByRole('button', { name: 'Выйти' }).click(),
    ]);
    await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' });
};

test.describe('UC-A1: шапка вошедшего', () => {
    test('после входа без перезагрузки шапка показывает меню кабинета; выход возвращает на главную', async ({
        page,
    }) => {
        await open(page, '/?from=header');
        const header = page.getByRole('banner');
        await markNoReload(page);

        await signInByEmail(page, 'Анна');

        expect(await stillSamePage(page)).toBe(true);
        await expect(header.getByRole('button', { name: 'Войти' })).toHaveCount(0);
        const account = header.getByRole('button', { name: /Анна/ });
        await expect(account).toBeVisible();

        await account.click();
        const menu = page.getByRole('group', { name: 'Кабинет' });
        await expect(menu.getByText('Покупаю')).toBeVisible();
        await expect(menu.getByText('Продаю')).toBeVisible();
        for (const link of ['Избранное', 'Объявления', 'Сообщения', 'Профиль']) {
            await expect(menu.getByRole('link', { name: link })).toBeVisible();
        }
        expect(await seriousOrCritical(page)).toEqual([]);

        // Обновление страницы: вошедший виден и в серверной разметке.
        await page.reload();
        await expect(header.getByRole('button', { name: /Анна/ })).toBeVisible();

        await header.getByRole('button', { name: /Анна/ }).click();
        await logOut(page);

        await expect(page).toHaveURL(/\/$/);
        await expect(header.getByRole('button', { name: 'Войти' })).toBeVisible();
        await expect(header.getByRole('button', { name: /Анна/ })).toHaveCount(0);
    });

    test('после выхода повторный POST со старым токеном отклоняется (419)', async ({ page }) => {
        await open(page, '/');
        await signInByEmail(page);
        const oldToken = await page.evaluate(() =>
            decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]*)/)?.[1] ?? ''),
        );
        expect(oldToken).not.toBe('');

        await page.getByRole('banner').getByRole('button', { name: /Анна/ }).click();
        await logOut(page);

        const replay = await page.request.post('/auth/logout', {
            headers: { 'X-XSRF-TOKEN': oldToken, Accept: 'application/json' },
        });
        expect(replay.status()).toBe(419);
    });

    test('меню закрывается по Esc, фокус возвращается на кнопку', async ({ page }) => {
        await open(page, '/');
        await signInByEmail(page);
        const account = page.getByRole('banner').getByRole('button', { name: /Анна/ });

        await account.focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('group', { name: 'Кабинет' })).toBeVisible();
        await page.keyboard.press('Escape');

        await expect(page.getByRole('group', { name: 'Кабинет' })).toBeHidden();
        await expect(account).toBeFocused();
    });

    test('клик по «Войти» до гидратации открывает окно, когда страница ожила', async ({ page }) => {
        // Бандл приложения задерживаем: страница приходит серверной разметкой, но не оживает.
        let release: () => void = () => {};
        const held = new Promise<void>((done) => (release = done));
        await page.route(
            /\/build\/assets\/app-.*\.js$|\/resources\/js\/app\.tsx/,
            async (route) => {
                await held;
                await route.continue();
            },
        );
        // Модульный скрипт откладывает DOMContentLoaded: ждём только ответ сервера (SSR-разметку).
        await page.goto('/', { waitUntil: 'commit' });
        await expect(page.getByRole('banner').getByRole('button', { name: 'Войти' })).toBeVisible();

        await page.getByRole('banner').getByRole('button', { name: 'Войти' }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);

        release();
        await expect(page.getByRole('dialog', { name: 'Вход', exact: true })).toBeVisible();
    });
});

test.describe('UC-A1: шапка вошедшего на телефоне', () => {
    test('390 px: «Кабинет» открывает меню кабинета, элементы не меньше 44 px, выход', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 740 });
        await open(page, '/');
        const bar = page.getByRole('navigation', { name: 'Нижнее меню' });

        // Шапки «Войти» на телефоне нет: окно открывает вкладка «Кабинет».
        await signInByEmail(page, 'Анна', bar.getByRole('link', { name: 'Кабинет' }));

        await bar.getByRole('link', { name: 'Кабинет' }).click();
        const menu = page.getByRole('group', { name: 'Кабинет' });
        await expect(menu).toBeVisible();
        for (const control of [
            menu.getByRole('link', { name: 'Избранное' }),
            menu.getByRole('button', { name: 'Выйти' }),
        ]) {
            expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
        }
        const box = await menu.boundingBox();
        expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
            ),
        ).toBe(false);
        await expect(page.locator('#nprogress')).toHaveCount(0); // полоса загрузки Inertia не мешает axe
        expect(await seriousOrCritical(page)).toEqual([]);

        await logOut(page);
        await expect(bar.getByRole('link', { name: 'Кабинет' })).toBeVisible();
        await bar.getByRole('link', { name: 'Кабинет' }).click();
        await expect(page.getByRole('dialog', { name: 'Вход', exact: true })).toBeVisible();
    });
});
