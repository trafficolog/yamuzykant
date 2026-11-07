import { test } from '@playwright/test';
import { signIn } from '../_seller';
import { expectMatchesReference } from './_helpers';

// Экран «sell» (гейт G1): пустая форма «Продать инструмент» против design/screens/sell@1440.png.
// Эталон @390 не снимается: прототип не адаптивен, мобильная раскладка принимается по чек-листу
// SCREENS.md §3 (решение OWNER 03.11.2026) — её проверяет UC-L1.spec.ts. Блоки «Проверка мастером» и
// справочник цен выключены флагами, остальные отличия записаны в design/DEVIATIONS.md.
test.describe('@visual sell', () => {
    for (const viewport of ['1440']) {
        test(`sell@${viewport}`, async ({ page }) => {
            await signIn(page);
            await page.goto('/sell');
            await expectMatchesReference(page, 'sell', viewport);
        });
    }
});
