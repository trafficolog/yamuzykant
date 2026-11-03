import { test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';
import { enableAllFlags, keepOnly, withPrototypeBoxModel } from './_isolate';

// Экран «header» (гейт G0): шапка PublicLayout на главной против design/screens/header@1440.png.
// На 390 эталона нет (SCREENS.md, решение OWNER 03.11.2026): мобильная шапка — чек-лист SCREENS §3,
// его проверяет tests/e2e/public-layout.spec.ts; мобильная раскладка — задача 6.1.1.
//
// Первый тест — шапка в R1: флаги вне MVP выключены, вкладок «Каталог», «Аксессуары», «Мастера»,
// «Цены продаж» нет. Второй — те же компоненты с включёнными флагами и с коробочной моделью
// прототипа (он нарисован без `.ym-root`, см. withPrototypeBoxModel): так видно, что композиция
// совпадает с прототипом, когда разделы появятся. Порог в обоих случаях из manifest.
// Тесты делят один файл эталона во временной папке, поэтому идут по очереди.
test.describe.configure({ mode: 'serial' });

test.describe('@visual header', () => {
    for (const viewport of ['1440']) {
        test(`header@${viewport}`, async ({ page }) => {
            await page.goto('/');
            await keepOnly(page, 'header');
            await expectMatchesReference(page, 'header', viewport);
        });

        test(`header@${viewport}, все флаги включены`, async ({ page }) => {
            await enableAllFlags(page);
            await page.goto('/');
            await keepOnly(page, 'header');
            await withPrototypeBoxModel(page);
            await expectMatchesReference(page, 'header', viewport);
        });
    }
});
