import { expect, test } from '@playwright/test';

// Эталон витрины /_ds снят с реализации в Linux-контейнере Playwright той же версии, что в CI
// (mcr.microsoft.com/playwright:v<версия>-noble), файл ds.visual.spec.ts-snapshots/*-linux.png.
// Снимки win32 и darwin в git не попадают (.gitignore): локально на Windows и macOS тест не проходит
// и запускается в контейнере. Эталон принимает OWNER на гейте G0.
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
