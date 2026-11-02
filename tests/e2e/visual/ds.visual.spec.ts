import { expect, test } from '@playwright/test';

// Эталон снимается с реализации и принимается OWNER (карточка 0.2.1).
// Обновление: npx playwright test --grep @visual --update-snapshots
test.describe('@visual витрина /_ds', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

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
