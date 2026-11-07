import { expect, type Locator, type Page } from '@playwright/test';

// Общие шаги e2e для окна входа и шапки вошедшего. Нужны LOGIN_CODE_FAKE=123456 (окружение e2e, CI).

export const FAKE_CODE = '123456';

let counter = 0;
/** Новая почта на каждый тест: аккаунт создаётся при первом входе, повторный прогон не мешает. */
export const freshEmail = (prefix = 'uc-a1') =>
    `${prefix}-${Date.now()}-${(counter += 1)}@example.com`;

/** Страница загружена и гидратирована (`html[data-hydrated]`, ставит каркас): клик до этого ничего не откроет. */
export const open = async (page: Page, url: string) => {
    await page.goto(url);
    await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' });
};

export const requestCode = async (page: Page, email: string) => {
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Почта').fill(email);
    await dialog.getByRole('button', { name: 'Получить код' }).click();
    await expect(dialog.getByLabel('Код из письма')).toBeVisible();
};

/**
 * Вход по почте через окно: код, первый вход (имя, согласие). Окно открывает `trigger`
 * (по умолчанию «Войти» в шапке; на телефоне — вкладка «Кабинет»); на выходе окно закрыто, страница обновлена на месте.
 */
export const signInByEmail = async (page: Page, name = 'Анна', trigger?: Locator) => {
    await (trigger ?? page.getByRole('banner').getByRole('button', { name: 'Войти' })).click();
    const dialog = page.getByRole('dialog', { name: 'Вход', exact: true });
    await expect(dialog).toBeVisible();
    await requestCode(page, freshEmail('uc-a1-account'));
    await dialog.getByLabel('Код из письма').fill(FAKE_CODE);
    await dialog.getByLabel('Имя').fill(name);
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Продолжить' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
};
