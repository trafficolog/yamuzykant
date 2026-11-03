import { test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';
import { keepOnly } from './_isolate';

// Экран «footer» (гейт G0): подвал PublicLayout на главной против design/screens/footer@{1440,390}.png.
// Ссылки на разделы вне MVP скрыты флагами, MAX вместо YouTube — как в прототипе «Подвал».
test.describe('@visual footer', () => {
    for (const viewport of ['1440', '390']) {
        test(`footer@${viewport}`, async ({ page }) => {
            await page.goto('/');
            await keepOnly(page, 'footer');
            await expectMatchesReference(page, 'footer', viewport);
        });
    }
});
