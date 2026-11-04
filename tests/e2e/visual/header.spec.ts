import { test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';
import { enableAllFlags, keepOnly, withPrototypeBoxModel } from './_isolate';

// Экран «header» (гейт G0): шапка PublicLayout на главной против design/screens/header@1440.png.
// На 390 эталона нет (SCREENS.md, решение OWNER 03.11.2026): мобильная шапка — чек-лист SCREENS §3,
// его проверяет tests/e2e/public-layout.spec.ts; мобильная раскладка — задача 6.1.1.
//
// Эталон прототипа — снимок блока `header` (manifest.block), а не страницы на белом поле: порог
// считается от площади шапки (0.2.6, аудит G0 R5). Прототип нарисован со всеми разделами, поэтому
// композиция сверяется с включёнными флагами и с коробочной моделью прототипа (он нарисован без
// `.ym-root`, см. withPrototypeBoxModel). То, что видят пользователи (R1, флаги вне MVP выключены),
// сверяется с эталоном состояния header--r1@1440.png, снятым с реализации (принимает OWNER на G1).
// Порог из manifest.
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

// R1-вид (флаги выключены) — то, что видят пользователи: эталон состояния `header--r1@{vp}.png`,
// снятый с реализации блоком и принятый OWNER на G1; порог из manifest, без подмены флагов.
test.describe('@visual header R1', () => {
    for (const viewport of ['1440']) {
        test(`header@${viewport}, R1`, async ({ page }) => {
            await page.goto('/');
            await keepOnly(page, 'header');
            await expectMatchesReference(page, 'header', viewport, { state: 'r1' });
        });
    }
});
