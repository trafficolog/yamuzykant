import { expect, type Browser, type Page } from '@playwright/test';

// Общие шаги e2e сообщений (4.1.2). Нужны LOGIN_CODE_FAKE=123456 и YANDEX_OAUTH_FAKE (окружение e2e, CI),
// Reverb и queue:work (ci.yml) — для доставки в реальном времени.

async function xsrf(page: Page): Promise<string> {
    const cookie = (await page.context().cookies()).find((c) => c.name === 'XSRF-TOKEN');
    if (!cookie) throw new Error('Нет cookie XSRF-TOKEN');
    return decodeURIComponent(cookie.value);
}

export async function post(page: Page, url: string, data: Record<string, unknown>) {
    return page.request.post(url, {
        data,
        headers: { 'X-XSRF-TOKEN': await xsrf(page), Accept: 'application/json' },
    });
}

/** Новый пользователь в своём контексте браузера: вход по коду и регистрация (без окна входа). */
export async function signedInPage(
    browser: Browser,
    name: string,
    viewport?: { width: number; height: number },
): Promise<Page> {
    const context = await browser.newContext(viewport ? { viewport } : {});
    const page = await context.newPage();
    await page.goto('/');
    const email = `d1-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
    for (const [url, data] of [
        ['/auth/email/code', { email }],
        ['/auth/email/verify', { email, code: '123456' }],
        ['/auth/register', { name, consent: true }],
    ] as const) {
        const response = await post(page, url, data);
        expect(response.ok(), `${url}: ${response.status()}`).toBeTruthy();
    }
    return page;
}

/** Опубликованное объявление вошедшего продавца (служебная страница 4.1.1, только local/testing/e2e). */
export async function sellerListingId(seller: Page): Promise<string> {
    await seller.goto('/_e2e/messaging');
    return seller.getByTestId('listing-id').innerText();
}

/** Страница загружена и гидратирована: до этого клавиши и клики ничего не сделают. */
export async function hydrated(page: Page, url: string): Promise<void> {
    await page.goto(url);
    await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' });
}

/** Беседа покупателя по объявлению через JSON-эндпоинт 4.1.1; возвращает id беседы. */
export async function startConversation(
    buyer: Page,
    listingId: string,
    body: string,
): Promise<string> {
    const response = await post(buyer, `/listings/${listingId}/conversations`, { body });
    expect(response.status()).toBe(201);
    return ((await response.json()) as { conversation: { id: string } }).conversation.id;
}
