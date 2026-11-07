import { test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';
import { waitForFonts } from '../../../tools/deterministic-page.mjs';

// Экран «flea» (гейт G1): выдача Барахолки. Прототип нарисован с элементами вне MVP (CatalogSwitch,
// «Безопасная сделка», бренд, «Проверено мастером», расстояние, стоимость доставки) и без фото, поэтому
// вид R1 сверяется с эталоном состояния flea--r1@1440.png, снятым с реализации (design/DEVIATIONS.md,
// принимает OWNER на G1). Эталон состояния берётся из артефакта visual-diff прогона CI.
// Адрес даёт стабильные 8 карточек: электрогитары с доставкой.
test.describe('@visual flea', () => {
    for (const viewport of ['1440']) {
        test(`flea@${viewport}, R1`, async ({ page }) => {
            await page.goto('/baraholka/gitary/elektrogitary?ship=1&sort=cheap');
            // TEMP: снять эталон с CI (будет удалено)
            await page.setViewportSize({ width: 1440, height: 900 });
            await page.waitForLoadState('networkidle');
            await waitForFonts(page);
            await page.screenshot({
                path: 'test-results/flea-r1-actual.png',
                fullPage: true,
                animations: 'disabled',
                caret: 'hide',
                scale: 'css',
            });
            await expectMatchesReference(page, 'flea', viewport, { state: 'r1' });
        });
    }
});
