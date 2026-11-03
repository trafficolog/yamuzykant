import { test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';
import { enableAllFlags, keepOnly, withPrototypeBoxModel } from './_isolate';

// Экран «header» (гейт G0): шапка PublicLayout на главной против design/screens/header@1440.png.
// На 390 эталона нет (SCREENS.md, решение OWNER 03.11.2026): мобильная шапка — чек-лист SCREENS §3,
// его проверяет tests/e2e/public-layout.spec.ts; мобильная раскладка — задача 6.1.1.
//
// Эталон — снимок блока `header` (manifest.block), а не страницы на белом поле: порог считается
// от площади шапки (0.2.6, аудит G0 R5). Шапка в R1 (флаги вне MVP выключены, вкладок «Каталог»,
// «Аксессуары», «Мастера», «Цены продаж» нет) ниже эталона на 12 px, а Playwright не сравнивает
// снимки разной высоты, поэтому композиция сверяется с включёнными флагами и с коробочной моделью
// прототипа (он нарисован без `.ym-root`, см. withPrototypeBoxModel). Состав шапки в R1 проверяет
// tests/e2e/public-layout.spec.ts. Порог из manifest.
test.describe('@visual header', () => {
    for (const viewport of ['1440']) {
        test(`header@${viewport}, все флаги включены`, async ({ page }) => {
            await enableAllFlags(page);
            await page.goto('/');
            await keepOnly(page, 'header');
            await withPrototypeBoxModel(page);
            await expectMatchesReference(page, 'header', viewport);
        });
    }
});
