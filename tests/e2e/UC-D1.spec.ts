import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { hydrated, post, sellerListingId, signedInPage, startConversation } from './_messaging';

// UC-D1 «Написать продавцу» (4.1.2): экран сообщений. Покупатель открывает «Написать» по объявлению,
// первое сообщение создаёт беседу; продавец видит её в списке с непрочитанным, ответ доходит до второй
// вкладки ≤ 2 с (Reverb), «прочитано» возвращается отправителю. Нужны Reverb и queue:work (ci.yml).

const seriousOrCritical = async (page: Page) => {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    return result.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => `${violation.id}: ${violation.nodes.map((n) => n.target).join(' | ')}`);
};

const field = (page: Page) => page.getByRole('textbox', { name: 'Сообщение' });
const thread = (page: Page) => page.getByRole('log');
const connected = (page: Page) => page.locator('[data-connection="connected"]');
const headerCounter = (page: Page) =>
    page.getByRole('banner').getByRole('link', { name: /^Сообщения/ });

test.describe('UC-D1: экран сообщений', () => {
    test('«Написать» → беседа → ответ продавца ≤ 2 с → прочитано, счётчик в шапке', async ({
        browser,
    }) => {
        const seller = await signedInPage(browser, 'Олег');
        const listingId = await sellerListingId(seller);
        const buyer = await signedInPage(browser, 'Анна');

        // Покупатель: «Написать продавцу» открывает черновик без беседы; Enter отправляет, адрес становится /messages/{id}.
        await hydrated(buyer, `/messages?listing=${listingId}`);
        await expect(buyer.getByRole('heading', { name: 'Олег' })).toBeVisible();
        await expect(buyer.getByRole('region', { name: 'Объявление' })).toContainText(
            'Fender ’57 Stratocaster',
        );
        const first = `Здравствуйте, гитара ещё продаётся? ${Date.now()}`;
        await field(buyer).fill(first);
        await field(buyer).press('Enter');
        await expect(buyer).toHaveURL(/\/messages\/[0-9a-f-]{36}$/);
        await expect(thread(buyer).getByText(first)).toBeVisible();
        await expect(connected(buyer)).toBeVisible({ timeout: 10_000 });

        // Продавец: в списке — беседа с непрочитанным, в шапке счётчик 1.
        await hydrated(seller, '/messages');
        await expect(headerCounter(seller)).toHaveAccessibleName('Сообщения, 1');
        const row = seller.getByRole('list', { name: 'Чаты' }).getByRole('link', { name: /Анна/ });
        await expect(row.getByLabel('1 непрочитанное')).toBeVisible();
        await row.click();
        await expect(thread(seller).getByText(first)).toBeVisible();
        await expect(connected(seller)).toBeVisible({ timeout: 10_000 });
        // Открыл чат — сообщения прочитаны: счётчик исчез, у покупателя «Прочитано».
        await expect(headerCounter(seller)).toHaveAccessibleName('Сообщения');
        await expect(buyer.getByLabel('Прочитано')).toBeVisible({ timeout: 5_000 });

        // Ответ с переносом строки (Shift+Enter) — во вкладке покупателя ≤ 2 с, без перезагрузки.
        await field(seller).fill('Да, после 12');
        await field(seller).press('Shift+Enter');
        await field(seller).pressSequentially('Можно в субботу');
        await field(seller).press('Enter');
        await expect(buyer.getByText('Можно в субботу')).toBeVisible({ timeout: 2_000 });
        await expect(thread(seller).getByText('Можно в субботу')).toBeVisible();

        // Покупатель видит счётчик в шапке, пока чат закрыт: закрыл чат (на список) и получил новое.
        await buyer.getByRole('button', { name: 'Закрыть чат' }).click();
        await expect(buyer).toHaveURL(/\/messages$/);
        await field(seller).fill('И захватите документы');
        await field(seller).press('Enter');
        await expect(headerCounter(buyer)).toHaveAccessibleName('Сообщения, 1', { timeout: 2_000 });
        const buyerRow = buyer
            .getByRole('list', { name: 'Чаты' })
            .getByRole('link', { name: /Олег/ });
        await expect(buyerRow).toContainText('И захватите документы');
        expect(await seriousOrCritical(buyer)).toEqual([]);
    });

    test('без сети: «Не отправлено · Повторить»; после возврата сети повтор доставляет', async ({
        browser,
    }) => {
        const seller = await signedInPage(browser, 'Олег');
        const listingId = await sellerListingId(seller);
        const buyer = await signedInPage(browser, 'Анна');
        const conversationId = await startConversation(buyer, listingId, 'Здравствуйте');

        await hydrated(buyer, `/messages/${conversationId}`);
        await expect(thread(buyer).getByText('Здравствуйте')).toBeVisible();

        await buyer.context().setOffline(true);
        await field(buyer).fill('Это без сети');
        await field(buyer).press('Enter');
        await expect(buyer.getByText('Не отправлено')).toBeVisible();
        await expect(buyer.getByRole('button', { name: 'Повторить' })).toBeVisible();

        await buyer.context().setOffline(false);
        await buyer.getByRole('button', { name: 'Повторить' }).click();
        await expect(buyer.getByText('Не отправлено')).toBeHidden();
        await expect(thread(buyer).getByText('Это без сети')).toHaveCount(1);

        await hydrated(seller, `/messages/${conversationId}`);
        await expect(thread(seller).getByText('Это без сети')).toBeVisible();
    });

    test('текст сообщения не исполняется, ссылки и телефоны не кликабельны', async ({
        browser,
    }) => {
        const seller = await signedInPage(browser, 'Олег');
        const listingId = await sellerListingId(seller);
        const buyer = await signedInPage(browser, 'Анна');
        const hostile =
            '<img src=x onerror="window.__xss=1"> https://evil.example/pay +7 999 123-45-67';
        const conversationId = await startConversation(buyer, listingId, hostile);

        await hydrated(seller, `/messages/${conversationId}`);
        await expect(thread(seller).getByText(hostile)).toBeVisible();
        expect(await thread(seller).locator('img, a').count()).toBe(0);
        expect(
            await seller.evaluate(() => (window as unknown as { __xss?: number }).__xss),
        ).toBeUndefined();
    });

    test('чужой пользователь не открывает беседу: 404 страницы и 403 канала', async ({
        browser,
    }) => {
        const seller = await signedInPage(browser, 'Олег');
        const listingId = await sellerListingId(seller);
        const buyer = await signedInPage(browser, 'Анна');
        const conversationId = await startConversation(buyer, listingId, 'Личное');

        const stranger = await signedInPage(browser, 'Чужой');
        const page = await stranger.goto(`/messages/${conversationId}`);
        expect(page?.status()).toBe(404);
        const auth = await post(stranger, '/broadcasting/auth', {
            socket_id: '1234.5678',
            channel_name: `private-conversation.${conversationId}`,
        });
        expect(auth.status()).toBe(403);
    });

    test('гость на /messages попадает на главную', async ({ page }) => {
        await page.goto('/messages');
        await expect(page).toHaveURL(/\/$/);
    });

    test('телефон 390 px: вкладка «Сообщения» → список → чат на весь экран → назад', async ({
        browser,
    }) => {
        const seller = await signedInPage(browser, 'Олег');
        const listingId = await sellerListingId(seller);
        const buyer = await signedInPage(browser, 'Анна', { width: 390, height: 844 });
        await startConversation(buyer, listingId, 'Здравствуйте с телефона');

        await hydrated(buyer, '/');
        await buyer
            .getByRole('navigation', { name: 'Нижнее меню' })
            .getByRole('link', { name: /Сообщения/ })
            .click();
        await expect(buyer).toHaveURL(/\/messages$/);
        await expect(buyer.getByRole('region', { name: 'Список чатов' })).toBeVisible();
        await expect(buyer.getByRole('region', { name: 'Переписка' })).toBeHidden();

        await buyer.getByRole('list', { name: 'Чаты' }).getByRole('link', { name: /Олег/ }).click();
        await expect(thread(buyer).getByText('Здравствуйте с телефона')).toBeVisible();
        await expect(buyer.getByRole('region', { name: 'Список чатов' })).toBeHidden();
        const box = await field(buyer).boundingBox();
        expect(box && box.x + box.width).toBeLessThanOrEqual(390);
        expect(
            await buyer.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(390);

        await buyer.getByRole('button', { name: 'Закрыть чат' }).click();
        await expect(buyer.getByRole('region', { name: 'Список чатов' })).toBeVisible();
        expect(await seriousOrCritical(buyer)).toEqual([]);
    });
});
