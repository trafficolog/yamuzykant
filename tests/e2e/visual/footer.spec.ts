import { test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';
import { enableAllFlags, keepOnly, withPrototypeBoxModel } from './_isolate';

// Экран «footer» (гейт G0): подвал PublicLayout на главной против design/screens/footer@{1440,390}.png.
// MAX вместо YouTube — как в прототипе «Подвал».
//
// Эталон — снимок блока `footer` (manifest.block), а не страницы на белом поле: порог считается
// от площади подвала (0.2.6, аудит G0 R5). Подвал в R1 ниже эталона (ссылки на разделы вне MVP
// скрыты флагами: на 1440 px на 4 px, на 390 px — на 6 px и больше), а Playwright не сравнивает
// снимки разной высоты, поэтому композиция сверяется с включёнными флагами и с коробочной
// моделью прототипа (он нарисован без `.ym-root`, см. withPrototypeBoxModel). Наличие подвала
// и его SSR проверяет tests/e2e/public-layout.spec.ts. Порог из manifest.
test.describe('@visual footer', () => {
    for (const viewport of ['1440', '390']) {
        test(`footer@${viewport}, все флаги включены`, async ({ page }) => {
            await enableAllFlags(page);
            await page.goto('/');
            await keepOnly(page, 'footer');
            await withPrototypeBoxModel(page);
            await expectMatchesReference(page, 'footer', viewport);
        });
    }
});

// R1-вид (флаги выключены) — то, что видят пользователи: эталон состояния `footer--r1@{vp}.png`,
// снятый с реализации блоком и принятый OWNER на G1; порог из manifest, без подмены флагов.
test.describe('@visual footer R1', () => {
    for (const viewport of ['1440', '390']) {
        test(`footer@${viewport}, R1`, async ({ page }) => {
            await page.goto('/');
            await keepOnly(page, 'footer');
            await expectMatchesReference(page, 'footer', viewport, { state: 'r1' });
        });
    }
});
