import { expect, type Page } from '@playwright/test';
import { addPhoto } from './_seller';

/**
 * Публикует объявление через форму «Продать инструмент»: модель, состояние, цена, три фото (серийный номер, два общих).
 * На выходе — экран «Объявление опубликовано». Продавец уже вошёл (`signIn`), город — тихий (`useQuietCity`).
 */
export async function publishViaForm(page: Page, title: string, price: string): Promise<void> {
    await page.goto('/sell');
    await page.getByRole('radio', { name: 'Гитары' }).click();
    await page.getByRole('combobox', { name: 'Бренд и модель' }).fill(title);
    await page.getByRole('radio', { name: 'Отличное' }).click();
    await page.getByRole('textbox', { name: 'Цена' }).fill(price);
    await addPhoto(page, 'Серийный номер', 1);
    await expect(page.getByRole('img', { name: 'Фото серийного номера' })).toBeVisible({
        timeout: 15_000,
    });
    await addPhoto(page, 'Общий вид', 2);
    await expect(page.getByRole('img', { name: 'Фото 2' })).toBeVisible({ timeout: 15_000 });
    await addPhoto(page, 'Корпус крупно', 3);
    await expect(page.getByRole('img', { name: 'Фото 3' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Опубликовать' }).click();
    await expect(
        page.getByRole('heading', { level: 2, name: 'Объявление опубликовано' }),
    ).toBeVisible();
}
