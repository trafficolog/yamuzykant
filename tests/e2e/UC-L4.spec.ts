import { expect, test } from '@playwright/test';
import { publishViaForm } from './_listings';
import { signIn, useQuietCity } from './_seller';

// UC-L4 «Снять с продажи» (2.1.5): причина и необязательная итоговая цена, возврат в продажу.
// Итоговая цена публично не видна: ни в списке кабинета, ни на странице объявления.

const TITLE = 'Fender American Vintage ’57 Stratocaster';

test.describe('UC-L4: снять с продажи', () => {
    test('«Продал на ЯМузыканте» с суммой: объявление снято, сумма нигде не показана; возврат в продажу', async ({
        page,
    }) => {
        await signIn(page);
        await useQuietCity(page);
        await publishViaForm(page, TITLE, '184500');

        await page.goto('/account/listings');
        await page.getByRole('button', { name: 'Снять с продажи' }).click();
        const dialog = page.getByRole('dialog', { name: 'Снять с продажи' });
        const submit = dialog.getByRole('button', { name: 'Снять с продажи' });
        await expect(submit).toBeDisabled();

        await dialog.getByRole('radio', { name: 'Продал на ЯМузыканте' }).check();
        await dialog.getByRole('textbox', { name: /За сколько продали/ }).fill('170000');
        await submit.click();

        await expect(dialog).toBeHidden();
        const card = page.getByRole('listitem').filter({ hasText: TITLE });
        await expect(card.getByText('Снято с продажи')).toBeVisible();
        await expect(page.getByText(/170\s000/)).toHaveCount(0);

        await card.getByRole('button', { name: 'Вернуть в продажу' }).click();
        await expect(card.getByText('Опубликовано')).toBeVisible();
    });

    test('«Передумал»: поля суммы нет, объявление снято', async ({ page }) => {
        await signIn(page);
        await useQuietCity(page);
        await publishViaForm(page, TITLE, '184500');

        await page.goto('/account/listings');
        await page.getByRole('button', { name: 'Снять с продажи' }).click();
        const dialog = page.getByRole('dialog', { name: 'Снять с продажи' });
        await dialog.getByRole('radio', { name: 'Передумал' }).check();
        await expect(dialog.getByRole('textbox')).toHaveCount(0);
        await dialog.getByRole('button', { name: 'Снять с продажи' }).click();

        await expect(dialog).toBeHidden();
        await expect(
            page.getByRole('listitem').filter({ hasText: TITLE }).getByText('Снято с продажи'),
        ).toBeVisible();
    });
});
