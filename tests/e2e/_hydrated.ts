import type { Page } from '@playwright/test';

/** Страница оживлена (`html[data-hydrated="true"]`, ставит каркас): клики и клавиши до этого ничего не сделают. */
export const awaitHydrated = (page: Page) =>
    page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' });

/** Открывает страницу и ждёт гидратации. */
export async function hydrated(page: Page, url: string): Promise<void> {
    await page.goto(url);
    await awaitHydrated(page);
}
