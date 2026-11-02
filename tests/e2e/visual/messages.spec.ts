import { test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';

// Заготовка визуального теста экрана «messages» (гейт G1). Экрана в реализации ещё нет:
// когда он появится, укажите маршрут в page.goto, замените test.fixme на test и прогоните
// npm run test:visual -- --grep messages. Эталон, маски и порог берутся из design/screens/manifest.json.
test.describe('@visual messages', () => {
    for (const viewport of ['1440', '390']) {
        test.fixme(`messages@${viewport}`, async ({ page }) => {
            await page.goto('/'); // TODO: маршрут экрана «messages»
            await expectMatchesReference(page, 'messages', viewport);
        });
    }
});
