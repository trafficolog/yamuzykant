import { test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';

// Заготовка визуального теста экрана «sell» (гейт G1). Экрана в реализации ещё нет:
// когда он появится, укажите маршрут в page.goto, замените test.fixme на test и прогоните
// npm run test:visual -- --grep sell. Эталон, маски и порог берутся из design/screens/manifest.json.
test.describe('@visual sell', () => {
    for (const viewport of ['1440', '390']) {
        test.fixme(`sell@${viewport}`, async ({ page }) => {
            await page.goto('/'); // TODO: маршрут экрана «sell»
            await expectMatchesReference(page, 'sell', viewport);
        });
    }
});
