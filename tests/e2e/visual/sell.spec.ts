import { test } from '@playwright/test';
import { signIn } from '../_seller';
import { expectMatchesReference } from './_helpers';
import { enableAllFlags } from './_isolate';

// Экран «sell» (гейт G1): пустая форма «Продать инструмент» против design/screens/sell@1440.png.
// Эталон нарисован со всеми разделами шапки и подвала и с блоком «Проверка мастером», которые в R1 скрыты
// флагами, поэтому, как у footer, сверка идёт с включёнными флагами (только в этом тесте).
// Эталон @390 не снимается: прототип не адаптивен, мобильная раскладка принимается по чек-листу
// SCREENS.md §3 (решение OWNER 03.11.2026) — её проверяет UC-L1.spec.ts. Остальные отличия записаны в
// design/DEVIATIONS.md.
test.describe('@visual sell', () => {
    for (const viewport of ['1440']) {
        test(`sell@${viewport}`, async ({ page }) => {
            await signIn(page);
            await enableAllFlags(page, '/sell');
            await page.goto('/sell');
            await expectMatchesReference(page, 'sell', viewport);
        });
    }
});
