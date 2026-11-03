import { test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';

// Заготовка визуального теста экрана «flea» (гейт G1). Экрана в реализации ещё нет:
// когда он появится, укажите маршрут в page.goto, замените test.fixme на test и прогоните
// npm run test:visual -- --grep flea. Эталон, маски и порог берутся из design/screens/manifest.json.
test.describe('@visual flea', () => {
    for (const viewport of ['1440']) {
        test.fixme(`flea@${viewport}`, async ({ page }) => {
            await page.goto('/'); // TODO: маршрут экрана «flea»
            await expectMatchesReference(page, 'flea', viewport);
        });
    }
});
