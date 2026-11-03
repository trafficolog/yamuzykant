import { test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';

// Заготовка визуального теста экрана «help» (гейт G2). Экрана в реализации ещё нет:
// когда он появится, укажите маршрут в page.goto, замените test.fixme на test и прогоните
// npm run test:visual -- --grep help. Эталон, маски и порог берутся из design/screens/manifest.json.
test.describe('@visual help', () => {
    for (const viewport of ['1440', '390']) {
        test.fixme(`help@${viewport}`, async ({ page }) => {
            await page.goto('/'); // TODO: маршрут экрана «help»
            await expectMatchesReference(page, 'help', viewport);
        });
    }
});
