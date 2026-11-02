import { expect, test } from '@playwright/test';

test('проба CI 0.1.3: Playwright должен упасть', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Такого заголовка нет' })).toBeVisible({
        timeout: 2_000,
    });
});
