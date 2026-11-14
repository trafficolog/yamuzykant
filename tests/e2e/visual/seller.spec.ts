import { expect, test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';

// Экран «seller» (гейт G1): страница продавца против эталона. Прототип рисует магазин (рейтинг, отзывы, подписка,
// «Компания проверена», вкладки «Отзывы» и «О магазине»), вне MVP; поэтому сверка идёт с эталоном состояния
// seller--r1@1440.png, снятым с реализации (DEVIATIONS, принимает OWNER на G1). Данные — LotDemoSeeder
// (tests/e2e/global-setup.lot.ts). На 390 эталона нет (SCREENS §1, решение OWNER 03.11.2026): чек-лист SCREENS §3.
const LOT = '3a1f0c00-0000-4000-8000-000000000001';

test.describe('@visual seller', () => {
    for (const viewport of ['1440']) {
        test(`seller@${viewport}, R1`, async ({ page }) => {
            await page.goto(`/listings/${LOT}`);
            await page
                .getByRole('region', { name: 'Продавец' })
                .getByRole('link', { name: 'Гитарный угол' })
                .click();
            await expect(page.getByRole('list', { name: 'Объявления продавца' })).toBeVisible();
            await expectMatchesReference(page, 'seller', viewport, { state: 'r1' });
        });
    }
});
