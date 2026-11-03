import { test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';
import { enableAllFlags, keepOnly, withPrototypeBoxModel } from './_isolate';

// Экран «footer» (гейт G0): подвал PublicLayout на главной против design/screens/footer@{1440,390}.png.
// MAX вместо YouTube — как в прототипе «Подвал».
//
// footer@1440 — подвал в R1: ссылки на разделы вне MVP скрыты флагами и укладываются в порог.
// На 390 px в R1 подвал ниже эталона (скрытые ссылки), а Playwright не сравнивает снимки разной
// высоты, поэтому footer@390 и контрольный footer@1440 проверяются с включёнными флагами и с
// коробочной моделью прототипа (он нарисован без `.ym-root`, см. withPrototypeBoxModel): так
// сверяется композиция подвала с прототипом. Порог не менялся. Тесты делят один файл эталона
// во временной папке, поэтому идут по очереди.
test.describe.configure({ mode: 'serial' });

test.describe('@visual footer', () => {
    test('footer@1440', async ({ page }) => {
        await page.goto('/');
        await keepOnly(page, 'footer');
        await expectMatchesReference(page, 'footer', '1440');
    });

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
