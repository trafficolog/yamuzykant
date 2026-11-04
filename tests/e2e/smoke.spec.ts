import { expect, test } from '@playwright/test';

test.describe('smoke', () => {
    test('главная открывается без ошибок в консоли', async ({ page }) => {
        const problems: string[] = [];
        page.on('console', (message) => {
            if (message.type() === 'error' || message.type() === 'warning') {
                problems.push(`${message.type()}: ${message.text()}`);
            }
        });
        page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

        const response = await page.goto('/');
        expect(response?.status()).toBe(200);

        await expect(page.getByRole('heading', { level: 1, name: 'ЯМузыкант' })).toBeVisible();
        await page.waitForLoadState('networkidle');

        expect(problems).toEqual([]);
    });

    test('сервер отдаёт отрисованный «ЯМузыкант» без выполнения JS (SSR)', async ({ request }) => {
        const response = await request.get('/');
        expect(response.status()).toBe(200);

        const html = await response.text();
        expect(html).toMatch(/<h1[^>]*>ЯМузыкант<\/h1>/);
    });

    test('/health отвечает 200, status ok и проверки зависимостей', async ({ request }) => {
        const response = await request.get('/health');
        expect(response.status()).toBe(200);
        expect(await response.json()).toMatchObject({ status: 'ok', checks: { database: { status: 'ok' } } });
    });
});
