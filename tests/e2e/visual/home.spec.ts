import { test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';

// Экран «home» (гейт G1). Прототип нарисован с блоками вне MVP (подборки, «Проверка мастером», «Безопасная
// сделка», мастера, цены продаж) и без фото, поэтому вид R1 сверяется с эталоном состояния home--r1@1440.png,
// снятым с реализации в CI (design/DEVIATIONS.md, принимает OWNER на G1). Данные — FleaDemoSeeder (Москва).
test.describe('@visual home', () => {
    for (const viewport of ['1440']) {
        test(`home@${viewport}, R1`, async ({ page }) => {
            await page.goto('/');
            await expectMatchesReference(page, 'home', viewport, { state: 'r1' });
        });
    }
});
