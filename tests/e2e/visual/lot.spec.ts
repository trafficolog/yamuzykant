import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { expectMatchesReference } from './_helpers';

// Экран «lot» (гейт G1): страница объявления против эталона. В R1 нет блоков вне MVP (PriceGuide, паспорт,
// аксессуары, проверка мастером, расстояния, счётчики просмотров), поэтому прототипный lot@1440 с реализацией
// не сходится: сверка идёт с эталоном состояния lot--r1@1440.png, снятым с реализации (DEVIATIONS, принимает OWNER на G1).
// На 390 эталона нет (SCREENS §1, решение OWNER 03.11.2026): мобильная раскладка — чек-лист SCREENS §3.
const LOT = '3a1f0c00-0000-4000-8000-000000000001';
const APP_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

test.describe('@visual lot', () => {
    test.beforeAll(() => {
        execFileSync('php', ['artisan', 'db:seed', '--class=LotDemoSeeder', '--force'], {
            cwd: APP_ROOT,
            stdio: 'pipe',
        });
    });

    for (const viewport of ['1440']) {
        test(`lot@${viewport}, R1`, async ({ page }) => {
            await page.goto(`/listings/${LOT}`);
            await expect(page.getByRole('heading', { name: 'Похожие лоты рядом' })).toBeVisible({
                timeout: 30_000,
            });
            await expectMatchesReference(page, 'lot', viewport, { state: 'r1' });
        });
    }
});
