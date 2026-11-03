import { test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';

// Заготовка визуального теста экрана «home» (гейт G1). Экрана в реализации ещё нет:
// когда он появится, укажите маршрут в page.goto, замените test.fixme на test и прогоните
// npm run test:visual -- --grep home. Эталон, маски и порог берутся из design/screens/manifest.json.
test.describe('@visual home', () => {
    for (const viewport of ['1440', '390']) {
        test.fixme(`home@${viewport}`, async ({ page }) => {
            await page.goto('/'); // TODO: маршрут экрана «home»
            await expectMatchesReference(page, 'home', viewport);
        });
    }
});
