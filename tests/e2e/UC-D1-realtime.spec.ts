import { expect, test, type Browser, type Page } from '@playwright/test';

// UC-D1 (4.1.1): сообщение доходит до второй вкладки ≤ 2 с. Экран сообщений — задача 4.1.2, поэтому
// доставка проверяется на служебной странице /_e2e/messaging (только local, testing, e2e).
// В CI Reverb и queue:work запускаются в фоне (ci.yml), трансляция идёт через очередь после commit.

async function xsrf(page: Page): Promise<string> {
    const cookie = (await page.context().cookies()).find((c) => c.name === 'XSRF-TOKEN');
    if (!cookie) throw new Error('Нет cookie XSRF-TOKEN');
    return decodeURIComponent(cookie.value);
}

async function post(page: Page, url: string, data: Record<string, unknown>) {
    return page.request.post(url, {
        data,
        headers: { 'X-XSRF-TOKEN': await xsrf(page), Accept: 'application/json' },
    });
}

/** Новый пользователь в своём контексте браузера: вход по коду (LOGIN_CODE_FAKE в e2e) и регистрация. */
async function signedInPage(browser: Browser, name: string): Promise<Page> {
    const page = await (await browser.newContext()).newPage();
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

test.describe('UC-D1: сообщения в реальном времени', () => {
    test('сообщение покупателя доходит до вкладки продавца ≤ 2 с, третье лицо канал не открывает', async ({
        browser,
    }) => {
        const seller = await signedInPage(browser, 'Олег');
        await seller.goto('/_e2e/messaging');
        const listingId = await seller.getByTestId('listing-id').innerText();

        const buyer = await signedInPage(browser, 'Анна');
        const started = await post(buyer, `/listings/${listingId}/conversations`, {
            body: 'Здравствуйте, гитара ещё продаётся?',
        });
        expect(started.status()).toBe(201);
        const conversationId = ((await started.json()) as { conversation: { id: string } })
            .conversation.id;

        await seller.goto(`/_e2e/messaging/${conversationId}`);
        await buyer.goto(`/_e2e/messaging/${conversationId}`);
        await expect(seller.getByText('Здравствуйте, гитара ещё продаётся?')).toBeVisible();
        await expect(seller.getByRole('status')).toHaveText('Подключено', { timeout: 10_000 });
        await expect(buyer.getByRole('status')).toHaveText('Подключено', { timeout: 10_000 });

        const text = `Можно посмотреть в субботу? ${Date.now()}`;
        await buyer.getByRole('textbox', { name: 'Сообщение' }).fill(text);
        await buyer.getByRole('button', { name: 'Отправить' }).click();

        await expect(seller.getByText(text)).toBeVisible({ timeout: 2_000 });

        // Ответ продавца — так же быстро во вкладке покупателя.
        const reply = `Да, после 12 ${Date.now()}`;
        await seller.getByRole('textbox', { name: 'Сообщение' }).fill(reply);
        await seller.getByRole('button', { name: 'Отправить' }).click();
        await expect(buyer.getByText(reply)).toBeVisible({ timeout: 2_000 });

        // Третье лицо: подписка на чужой канал — 403, страница беседы — 404.
        const stranger = await signedInPage(browser, 'Чужой');
        const auth = await post(stranger, '/broadcasting/auth', {
            socket_id: '1234.5678',
            channel_name: `private-conversation.${conversationId}`,
        });
        expect(auth.status()).toBe(403);
        const page = await stranger.goto(`/_e2e/messaging/${conversationId}`);
        expect(page?.status()).toBe(404);
    });
});
