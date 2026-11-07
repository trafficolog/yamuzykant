import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { FAKE_CODE, freshEmail, open, requestCode } from './_auth';
import { forgetYandexTestUser } from './_environment';

// UC-A1 «Войти» (SPEC §4): окно входа в шапке — «Войти с Яндекс ID» и код из письма, первый вход
// (имя, город, согласие), возврат к прерванному действию. Нужны LOGIN_CODE_FAKE=123456 и
// YANDEX_OAUTH_FAKE=true (окружение e2e, CI) — настоящих писем и Яндекса в тестах нет.

const CANCELLED = 'Вход через Яндекс ID отменён. Войдите по почте или попробуйте ещё раз';

const seriousOrCritical = async (page: Page) => {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    return result.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => `${violation.id}: ${violation.nodes.map((n) => n.target).join(' | ')}`);
};

/** Окно открывается на шаге «Способ»: заголовок «Вход». Дальше имя окна меняется с шагом. */
const openDialog = async (page: Page) => {
    await page.getByRole('banner').getByRole('button', { name: 'Войти' }).click();
    await expect(page.getByRole('dialog', { name: 'Вход', exact: true })).toBeVisible();
    return page.getByRole('dialog');
};

test.describe('UC-A1: окно входа', () => {
    test('вход по почте: код, первый вход с согласием, возврат на ту же страницу без перезагрузки', async ({
        page,
    }) => {
        await open(page, '/?from=listing');
        const dialog = await openDialog(page);
        await expect(dialog.getByLabel('Почта')).toBeFocused();

        await requestCode(page, freshEmail());
        await expect(dialog.getByLabel('Код из письма')).toBeFocused();

        // Неверный код: ошибка текстом у поля, поле очищено.
        await dialog.getByLabel('Код из письма').fill('000000');
        await expect(
            dialog.getByText(
                'Неверный или устаревший код. Проверьте письмо или запросите новый код',
            ),
        ).toBeVisible();
        await expect(dialog.getByLabel('Код из письма')).toHaveValue('');

        // Шестая цифра отправляет код сама.
        await dialog.getByLabel('Код из письма').fill(FAKE_CODE);

        // Первый вход: «Продолжить» неактивна, над ней — что не заполнено.
        const proceed = dialog.getByRole('button', { name: 'Продолжить' });
        await expect(dialog.getByLabel('Имя')).toBeVisible();
        await expect(proceed).toBeDisabled();
        await expect(dialog).toContainText('Не заполнено: имя, согласие с правилами');
        await expect(dialog.getByRole('link', { name: 'правила' })).toBeVisible();
        await expect(
            dialog.getByRole('link', { name: 'политику обработки персональных данных' }),
        ).toBeVisible();

        await page.evaluate(() => {
            (window as unknown as { __noReload: boolean }).__noReload = true;
        });
        await dialog.getByLabel('Имя').fill('Анна');
        await expect(dialog).toContainText('Не заполнено: согласие с правилами');
        await dialog.getByRole('checkbox').check();
        await expect(proceed).toBeEnabled();
        await proceed.click();

        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(page).toHaveURL(/\/\?from=listing$/);
        expect(
            await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload),
        ).toBe(true);
    });

    test('повтор кода: до истечения 60 с кнопки нет, виден обратный отсчёт; «Изменить почту» возвращает на первый шаг', async ({
        page,
    }) => {
        await open(page, '/');
        await openDialog(page);
        const email = freshEmail();
        await requestCode(page, email);

        const dialog = page.getByRole('dialog');
        await expect(dialog.getByText(/Отправить код ещё раз можно через \d+ с/)).toBeVisible();
        await expect(dialog.getByRole('button', { name: 'Отправить код ещё раз' })).toHaveCount(0);

        await dialog.getByRole('button', { name: 'Изменить почту' }).click();
        await expect(dialog.getByLabel('Почта')).toHaveValue(email);
    });

    test('Esc закрывает окно, фокус возвращается на кнопку «Войти»; Tab не уходит за окно', async ({
        page,
    }) => {
        await open(page, '/');
        const opener = page.getByRole('banner').getByRole('button', { name: 'Войти' });
        await opener.focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        for (let step = 0; step < 12; step += 1) {
            await page.keyboard.press('Tab');
            expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(
                true,
            );
        }

        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(opener).toBeFocused();
    });

    test('вход через Яндекс ID (YANDEX_OAUTH_FAKE): возврат на страницу, где начат вход', async ({
        page,
    }) => {
        forgetYandexTestUser();
        await open(page, '/?from=yandex');
        const dialog = await openDialog(page);

        await dialog.getByRole('link', { name: 'Войти с Яндекс ID' }).click();

        // Аккаунта нет: шаг «Первый вход» с именем из Яндекс ID (first_name тестового пользователя).
        const first = page.getByRole('dialog');
        await expect(first.getByLabel('Имя')).toHaveValue('Анна');
        await first.getByRole('checkbox').check();
        await first.getByRole('button', { name: 'Продолжить' }).click();

        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(page).toHaveURL(/\/\?from=yandex$/);
    });

    test('отказ в Яндексе: окно открыто, текст отмены и вход по почте', async ({ page }) => {
        // Подмена: Яндекс «вернул» отказ вместо кода. state остаётся настоящим: берём его из ответа сервера.
        await page.route('**/auth/yandex/redirect**', async (route) => {
            const response = await route.fetch({ maxRedirects: 0 });
            const target = new URL(response.headers().location ?? '', 'http://127.0.0.1:8000');
            target.searchParams.delete('code');
            target.searchParams.set('error', 'access_denied');
            await route.fulfill({
                response,
                status: 302,
                headers: { ...response.headers(), location: target.toString() },
            });
        });
        await open(page, '/');
        const dialog = await openDialog(page);

        await dialog.getByRole('link', { name: 'Войти с Яндекс ID' }).click();

        const reopened = page.getByRole('dialog');
        await expect(reopened).toBeVisible();
        await expect(reopened.getByRole('alert')).toContainText(CANCELLED);
        await expect(reopened.getByLabel('Почта')).toBeVisible();
    });

    test('перехват 419: окно входа открывается, после входа страница обновляется на месте', async ({
        page,
    }) => {
        await open(page, '/?from=action');
        const header = page.getByRole('banner');
        let expired = true;
        await page.route('**/city', (route) => {
            if (route.request().method() === 'POST' && expired) {
                expired = false;
                return route.fulfill({
                    status: 419,
                    contentType: 'text/html',
                    body: 'Page Expired',
                });
            }
            return route.continue();
        });

        await header.getByRole('button', { name: 'Москва' }).click();
        await page
            .getByRole('dialog', { name: 'Выбор города' })
            .getByRole('button', { name: 'Казань' })
            .click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await requestCode(page, freshEmail());
        await dialog.getByLabel('Код из письма').fill(FAKE_CODE);
        await dialog.getByLabel('Имя').fill('Анна');
        await dialog.getByRole('checkbox').check();
        await dialog.getByRole('button', { name: 'Продолжить' }).click();

        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(page).toHaveURL(/\/\?from=action$/);
    });
});

test.describe('UC-A1: доступность окна входа (axe)', () => {
    test('десктоп: шаги «Способ», «Код», «Первый вход»', async ({ page }) => {
        await open(page, '/');
        const dialog = await openDialog(page);
        expect(await seriousOrCritical(page)).toEqual([]);

        await requestCode(page, freshEmail());
        expect(await seriousOrCritical(page)).toEqual([]);

        await dialog.getByLabel('Код из письма').fill(FAKE_CODE);
        await expect(dialog.getByLabel('Имя')).toBeVisible();
        expect(await seriousOrCritical(page)).toEqual([]);
    });

    test('ошибка и блок: axe чистый', async ({ page }) => {
        await open(page, '/');
        const dialog = await openDialog(page);
        await requestCode(page, freshEmail());
        await dialog.getByLabel('Код из письма').fill('000000');
        await expect(dialog.getByText(/Неверный или устаревший код/)).toBeVisible();

        expect(await seriousOrCritical(page)).toEqual([]);
    });
});

test.describe('UC-A1: окно входа на телефоне', () => {
    for (const width of [320, 390]) {
        test(`${width} px: вход через «Кабинет», окно в пределах экрана, без горизонтальной прокрутки, элементы не меньше 44 px, axe`, async ({
            page,
        }) => {
            await page.setViewportSize({ width, height: 740 });
            await open(page, '/');

            await page
                .getByRole('navigation', { name: 'Нижнее меню' })
                .getByRole('link', { name: 'Кабинет' })
                .click();
            const dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible();

            const box = await dialog.boundingBox();
            expect(box?.x).toBeGreaterThanOrEqual(0);
            expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);

            for (const control of [
                dialog.getByRole('link', { name: 'Войти с Яндекс ID' }),
                dialog.getByLabel('Почта'),
                dialog.getByRole('button', { name: 'Получить код' }),
                dialog.getByRole('button', { name: 'Закрыть окно входа' }),
            ]) {
                expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
            }

            const scrollsSideways = await page.evaluate(
                () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
            );
            expect(scrollsSideways).toBe(false);
            expect(await seriousOrCritical(page)).toEqual([]);

            await requestCode(page, freshEmail());
            await dialog.getByLabel('Код из письма').fill(FAKE_CODE);
            await expect(dialog.getByLabel('Имя')).toBeVisible();
            expect(await seriousOrCritical(page)).toEqual([]);

            await page.keyboard.press('Escape');
            await expect(dialog).toBeHidden();
        });
    }
});
