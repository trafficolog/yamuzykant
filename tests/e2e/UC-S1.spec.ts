import { expect, test } from '@playwright/test';

// UC-S1 «Выбрать город» (SPEC §4, BR-01): город в шапке, смена без перезагрузки страницы,
// гостевой выбор сохраняется между визитами (cookie).
// Выдача Барахолки и рельсы главной появятся в 3.1.2 и 3.1.4: там проверяется сам эффект на выдачу.

test.describe('UC-S1: выбор города гостем', () => {
    test('смена города через поиск в шапке обновляет кнопку без перезагрузки и сохраняется после F5', async ({
        page,
    }) => {
        await page.goto('/');
        const header = page.getByRole('banner');
        await expect(header.getByRole('button', { name: 'Москва' })).toBeVisible();

        // Метка в window переживает Inertia-визит, но не полную перезагрузку страницы.
        await page.evaluate(() => {
            (window as unknown as { __noReload: boolean }).__noReload = true;
        });

        await header.getByRole('button', { name: 'Москва' }).click();
        const panel = page.getByRole('dialog', { name: 'Выбор города' });
        await expect(panel.getByRole('searchbox', { name: 'Поиск города' })).toBeFocused();

        await panel.getByRole('searchbox', { name: 'Поиск города' }).fill('Казан');
        await panel.getByRole('button', { name: 'Казань' }).click();

        await expect(panel).toBeHidden();
        await expect(header.getByRole('button', { name: 'Казань' })).toBeVisible();
        expect(
            await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload),
        ).toBe(true);

        await page.reload();
        await expect(
            page.getByRole('banner').getByRole('button', { name: 'Казань' }),
        ).toBeVisible();
    });

    test('Esc закрывает окно выбора города и возвращает фокус на кнопку города', async ({
        page,
    }) => {
        await page.goto('/');
        const cityButton = page.getByRole('banner').getByRole('button', { name: 'Москва' });

        await cityButton.click();
        await page.keyboard.press('Escape');

        await expect(page.getByRole('dialog', { name: 'Выбор города' })).toBeHidden();
        await expect(cityButton).toBeFocused();
    });
});

const seriousOrCritical = async (page: Page) => {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    return result.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => `${violation.id}: ${violation.nodes.map((n) => n.target).join(' | ')}`);
};

test.describe('UC-S1: окно города в мобильной шапке', () => {
    for (const width of [320, 390]) {
        test(`${width} px: окно видно в пределах экрана, выбор работает, без горизонтальной прокрутки, пункт не меньше 44 px, axe`, async ({
            page,
        }) => {
            await page.setViewportSize({ width, height: 740 });
            await page.goto('/');
            const header = page.getByRole('banner');

            await header.getByRole('button', { name: 'Москва' }).click();
            const panel = page.getByRole('dialog', { name: 'Выбор города' });
            await expect(panel).toBeVisible();

            const box = await panel.boundingBox();
            expect(box).not.toBeNull();
            expect(box!.x).toBeGreaterThanOrEqual(0);
            expect(box!.x + box!.width).toBeLessThanOrEqual(width);

            const item = panel.getByRole('button', { name: 'Санкт-Петербург' });
            await expect(item).toBeVisible();
            const itemBox = await item.boundingBox();
            expect(itemBox!.height).toBeGreaterThanOrEqual(44);

            const scrollsSideways = await page.evaluate(
                () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
            );
            expect(scrollsSideways).toBe(false);

            expect(await seriousOrCritical(page)).toEqual([]);

            await item.click();
            await expect(panel).toBeHidden();
            await expect(header.getByRole('button', { name: 'Санкт-Петербург' })).toBeVisible();
        });
    }
});
