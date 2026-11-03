import { test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';

// Заготовка визуального теста экрана «header» (гейт G0). Экрана в реализации ещё нет:
// когда он появится, укажите маршрут в page.goto, замените test.fixme на test и прогоните
// npm run test:visual -- --grep header. Эталон, маски и порог берутся из design/screens/manifest.json.
test.describe('@visual header', () => {
    for (const viewport of ['1440', '390']) {
        test.fixme(`header@${viewport}`, async ({ page }) => {
            await page.goto('/'); // TODO: маршрут экрана «header»
            await expectMatchesReference(page, 'header', viewport);
        });
    }
});
