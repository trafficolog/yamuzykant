import { test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';

// Заготовка визуального теста экрана «emails» (гейт G1). Экрана в реализации ещё нет:
// когда он появится, укажите маршрут в page.goto, замените test.fixme на test и прогоните
// npm run test:visual -- --grep emails. Эталон, маски и порог берутся из design/screens/manifest.json.
test.describe('@visual emails', () => {
    for (const viewport of ['1440']) {
        test.fixme(`emails@${viewport}`, async ({ page }) => {
            await page.goto('/'); // TODO: маршрут экрана «emails»
            await expectMatchesReference(page, 'emails', viewport);
        });
    }
});
