import { test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';

// Заготовка визуального теста экрана «error» (гейт G2). Экрана в реализации ещё нет:
// когда он появится, укажите маршрут в page.goto, замените test.fixme на test и прогоните
// npm run test:visual -- --grep error. Эталон, маски и порог берутся из design/screens/manifest.json.
test.describe('@visual error', () => {
    for (const viewport of ['1440', '390']) {
        test.fixme(`error@${viewport}`, async ({ page }) => {
            await page.goto('/'); // TODO: маршрут экрана «error»
            await expectMatchesReference(page, 'error', viewport);
        });
    }
});
