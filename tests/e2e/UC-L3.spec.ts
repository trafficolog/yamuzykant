import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { publishViaForm } from './_listings';
import { signIn, useQuietCity } from './_seller';

// UC-L3 «Изменить объявление, снизить цену» (2.1.5): вкладка «Объявления» кабинета, форма «Изменить»,
// окно «Снизить цену». Премодерация в e2e выключена: существенная правка тоже остаётся в published.

const NBSP = ' ';
const TITLE = 'Fender American Vintage ’57 Stratocaster';

test.describe('UC-L3: мои объявления — изменить и снизить цену', () => {
    test('вкладка «Объявления»: карточка со статусом и ценой, фильтр, axe', async ({ page }) => {
        await signIn(page);
        await useQuietCity(page);
        await publishViaForm(page, TITLE, '184500');

        await page.goto('/account/listings');
        await expect(page.getByRole('link', { name: 'Объявления', exact: true })).toHaveAttribute(
            'aria-current',
            'page',
        );
        const card = page.getByRole('listitem').filter({ hasText: TITLE });
        await expect(card.getByText('Опубликовано')).toBeVisible();
        await expect(card.getByText(`184${NBSP}500${NBSP}₽`)).toBeVisible();
        await expect(card.getByText(/^Просмотры: /)).toBeVisible();

        await page.getByRole('radio', { name: /На проверке/ }).click();
        await expect(page).toHaveURL(/status=review/);
        await expect(page.getByText('Нет объявлений с таким статусом.')).toBeVisible();

        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        expect(
            axe.violations
                .filter((v) => v.impact === 'serious' || v.impact === 'critical')
                .map((v) => v.id),
        ).toEqual([]);
    });

    test('«Изменить»: та же форма с данными объявления; рост цены — без проверки', async ({
        page,
    }) => {
        await signIn(page);
        await useQuietCity(page);
        await publishViaForm(page, TITLE, '184500');

        await page.goto('/account/listings');
        await page.getByRole('link', { name: 'Изменить' }).click();
        await expect(
            page.getByRole('heading', { level: 1, name: 'Изменить объявление' }),
        ).toBeVisible();
        await expect(page.getByRole('combobox', { name: 'Бренд и модель' })).toHaveValue(TITLE);
        await expect(page.getByRole('button', { name: 'Сохранить черновик' })).toHaveCount(0);

        await page.getByRole('textbox', { name: 'Цена' }).fill('200000');
        await page.getByRole('button', { name: 'Сохранить изменения' }).click();

        await expect(page).toHaveURL(/\/account\/listings$/);
        const card = page.getByRole('listitem').filter({ hasText: TITLE });
        await expect(card.getByText('Опубликовано')).toBeVisible();
        await expect(card.getByText(`200${NBSP}000${NBSP}₽`)).toBeVisible();
    });

    test('«Снизить цену»: окно, цена ниже текущей — без повторной проверки', async ({ page }) => {
        await signIn(page);
        await useQuietCity(page);
        await publishViaForm(page, TITLE, '184500');

        await page.goto('/account/listings');
        await page.getByRole('button', { name: 'Снизить цену' }).click();
        const dialog = page.getByRole('dialog', { name: 'Снизить цену' });
        await expect(dialog.getByText(`Сейчас: 184${NBSP}500${NBSP}₽`)).toBeVisible();

        const submit = dialog.getByRole('button', { name: 'Снизить цену' });
        await dialog.getByRole('textbox', { name: 'Новая цена' }).fill('190000');
        await expect(submit).toBeDisabled();
        await dialog.getByRole('textbox', { name: 'Новая цена' }).fill('170000');
        await submit.click();

        await expect(dialog).toBeHidden();
        const card = page.getByRole('listitem').filter({ hasText: TITLE });
        await expect(card.getByText(`170${NBSP}000${NBSP}₽`)).toBeVisible();
        await expect(card.getByText('Опубликовано')).toBeVisible();
    });
});
