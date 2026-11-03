import { test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';
import { keepOnly } from './_isolate';

// Экран «header» (гейт G0): шапка PublicLayout на главной против design/screens/header@1440.png.
// На 390 эталона нет (SCREENS.md, решение OWNER 03.11.2026): мобильная шапка — чек-лист SCREENS §3,
// его проверяет tests/e2e/public-layout.spec.ts; мобильная раскладка — задача 6.1.1.
// Флаги вне MVP выключены, поэтому вкладок «Каталог», «Аксессуары», «Мастера», «Цены продаж» в
// реализации нет — это учтено в описании PR, порог не меняется.
test.describe('@visual header', () => {
    for (const viewport of ['1440']) {
        test(`header@${viewport}`, async ({ page }) => {
            await page.goto('/');
            await keepOnly(page, 'header');
            await expectMatchesReference(page, 'header', viewport);
        });
    }
});
