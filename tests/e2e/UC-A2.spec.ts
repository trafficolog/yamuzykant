import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { hydrated, signedInPage } from './_messaging';
import { forbiddenIn, collectCopy } from './_copy';

// UC-A2 «Указать имя и город, настроить уведомления» (1.1.3): Кабинет → Профиль.
// Вход — по коду (LOGIN_CODE_FAKE=123456, окружение e2e).

const seriousOrCritical = async (page: Page) => {
    await expect(page.locator('#nprogress')).toHaveCount(0);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    return result.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => `${violation.id}: ${violation.nodes.map((n) => n.target).join(' | ')}`);
};

const main = (page: Page) => page.getByRole('main');
const tabs = (page: Page) => page.getByRole('navigation', { name: 'Разделы кабинета' });

test.describe('UC-A2: профиль', () => {
    test('из меню кабинета → «Профиль»: имя и город меняются, шапка и страница после F5 показывают новые', async ({
        browser,
    }) => {
        const page = await signedInPage(browser, 'Анна');
        await hydrated(page, '/');

        await page.getByRole('banner').getByRole('button', { name: /Анна/ }).click();
        await page
            .getByRole('group', { name: 'Кабинет' })
            .getByRole('link', { name: 'Профиль' })
            .click();
        await expect(page).toHaveURL(/\/account\/profile$/);
        await expect(main(page).getByRole('heading', { level: 1, name: 'Кабинет' })).toBeVisible();
        await expect(tabs(page).getByRole('link', { name: 'Профиль' })).toHaveAttribute(
            'aria-current',
            'page',
        );

        await main(page).getByLabel('Имя', { exact: true }).fill('Анна Ким');
        await main(page).getByRole('button', { name: 'Изменить город' }).click();
        await main(page).getByRole('searchbox', { name: 'Поиск города' }).fill('Казан');
        await main(page).getByRole('button', { name: 'Казань' }).click();
        await expect(main(page).getByText('г. Казань')).toBeVisible();
        await main(page).getByRole('button', { name: 'Сохранить' }).click();

        await expect(
            main(page).getByRole('status').filter({ hasText: 'Профиль сохранён' }),
        ).toBeVisible();
        await expect(
            page.getByRole('banner').getByRole('button', { name: /Анна Ким/ }),
        ).toBeVisible();
        await expect(
            page.getByRole('banner').getByRole('button', { name: 'Казань' }),
        ).toBeVisible();

        await page.reload();
        await expect(main(page).getByLabel('Имя', { exact: true })).toHaveValue('Анна Ким');
        await expect(main(page).getByText('г. Казань')).toBeVisible();
        await page.context().close();
    });

    test('пустое имя не сохраняется: ошибка у поля', async ({ browser }) => {
        const page = await signedInPage(browser, 'Анна');
        await hydrated(page, '/account/profile');

        await main(page).getByLabel('Имя', { exact: true }).fill('');
        await main(page).getByRole('button', { name: 'Сохранить' }).click();

        await expect(main(page).getByText('Укажите имя')).toBeVisible();
        await expect(main(page).getByLabel('Имя', { exact: true })).toHaveAttribute(
            'aria-invalid',
            'true',
        );
        await page.context().close();
    });

    test('почта входа видна только владельцу и не редактируется; Яндекс ID не подключён', async ({
        browser,
    }) => {
        const page = await signedInPage(browser, 'Анна');
        await hydrated(page, '/account/profile');

        const email = main(page).getByLabel('Почта для входа');
        await expect(email).toHaveValue(/@example\.test$/);
        await expect(email).not.toBeEditable();
        await expect(main(page).getByText('Яндекс ID подключён')).toHaveCount(0);
        await page.context().close();
    });

    test('уведомления: выключенный флажок сохраняется и остаётся после F5', async ({ browser }) => {
        const page = await signedInPage(browser, 'Анна');
        await hydrated(page, '/account/profile');

        const box = main(page).getByRole('checkbox', { name: /Письма о новых сообщениях/ });
        await expect(box).toBeChecked();
        await box.uncheck();
        await expect(
            main(page).getByRole('status').filter({ hasText: 'Настройки сохранены' }),
        ).toBeVisible();

        await page.reload();
        await expect(
            main(page).getByRole('checkbox', { name: /Письма о новых сообщениях/ }),
        ).not.toBeChecked();
        await page.context().close();
    });

    test('«Обзор»: блоки «Покупаю» и «Продаю»; вкладки только готовых разделов', async ({
        browser,
    }) => {
        const page = await signedInPage(browser, 'Анна');
        await hydrated(page, '/account');

        await expect(main(page).getByRole('region', { name: 'Покупаю' })).toBeVisible();
        await expect(main(page).getByRole('region', { name: 'Продаю' })).toBeVisible();
        await expect(
            tabs(page)
                .getByRole('link')
                .evaluateAll((links) => links.map((l) => l.textContent?.trim())),
        ).resolves.toEqual(['Обзор', 'Объявления', 'Сообщения', 'Профиль']);
        await page.context().close();
    });

    test('гость на /account уходит на главную', async ({ page }) => {
        await page.goto('/account/profile');
        await expect(page).toHaveURL(/\/$/);
    });

    test('axe без serious и critical, в тексте нет запрещённых слов; клавиатура доходит до «Сохранить»', async ({
        browser,
    }) => {
        const page = await signedInPage(browser, 'Анна');
        for (const url of ['/account', '/account/profile']) {
            await hydrated(page, url);
            expect(await seriousOrCritical(page), url).toEqual([]);
            expect(forbiddenIn(await collectCopy(page)), url).toEqual([]);
        }

        await main(page).getByLabel('Имя', { exact: true }).focus();
        // Имя → «Изменить город» → «Сохранить»: два Tab.
        for (let i = 0; i < 2; i += 1) await page.keyboard.press('Tab');
        await expect(main(page).getByRole('button', { name: 'Сохранить' })).toBeFocused();
        await page.context().close();
    });

    test('на 390 px вкладки кабинета прокручиваются по горизонтали, страница — нет', async ({
        browser,
    }) => {
        const page = await signedInPage(browser, 'Анна', { width: 390, height: 844 });
        await hydrated(page, '/account/profile');

        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        await expect(tabs(page).getByRole('link', { name: 'Профиль' })).toBeVisible();
        await page.context().close();
    });
});
