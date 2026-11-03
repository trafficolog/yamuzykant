import { test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';

// Заготовка визуального теста экрана «lot» (гейт G1). Экрана в реализации ещё нет:
// когда он появится, укажите маршрут в page.goto, замените test.fixme на test и прогоните
// npm run test:visual -- --grep lot. Эталон, маски и порог берутся из design/screens/manifest.json.
test.describe('@visual lot', () => {
    for (const viewport of ['1440']) {
        test.fixme(`lot@${viewport}`, async ({ page }) => {
            await page.goto('/'); // TODO: маршрут экрана «lot»
            await expectMatchesReference(page, 'lot', viewport);
        });
    }
});
