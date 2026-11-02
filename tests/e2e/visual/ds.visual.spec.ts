import { expect, test } from '@playwright/test';

// Эталон /_ds снимается в Linux-контейнере Playwright вместе с остальными эталонами в задаче 0.2.3
// (зависимость от 0.2.3). До этого тест пропущен: Windows-снимок CI на Linux не подошёл бы.
// Снять эталон: npx playwright test --grep @visual --update-snapshots (в контейнере Playwright).
test.describe('@visual витрина /_ds', () => {
    test.use({ viewport: { width: 1440, height: 900 } });
    test.skip(true, 'Ожидает эталон linux из 0.2.3');

    test('/_ds на 1440', async ({ page }) => {
        await page.goto('/_ds');
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => document.fonts.ready);

        await expect(page).toHaveScreenshot('ds-showcase@1440.png', {
            fullPage: true,
            animations: 'disabled',
            maxDiffPixelRatio: 0.02,
        });
    });
});
