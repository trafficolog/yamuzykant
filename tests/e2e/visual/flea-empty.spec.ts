import { test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';

// Заготовка визуального теста экрана «flea-empty» (гейт G1). Экрана в реализации ещё нет:
// когда он появится, укажите маршрут в page.goto, замените test.fixme на test и прогоните
// npm run test:visual -- --grep flea-empty. Эталон, маски и порог берутся из design/screens/manifest.json.
test.describe('@visual flea-empty', () => {
    for (const viewport of ['1440', '390']) {
        test.fixme(`flea-empty@${viewport}`, async ({ page }) => {
            await page.goto('/'); // TODO: маршрут экрана «flea-empty»
            await expectMatchesReference(page, 'flea-empty', viewport);
        });
    }
});
