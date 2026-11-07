import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { addPhoto, signIn, xsrf } from './_seller';

// UC-L1 «Подать объявление», часть 1 — заполнение формы (2.1.3): 4 шага, превью ListingCard,
// список недостающего над кнопкой, серверная проверка в обход клиента.
// Публикация, черновик с автосохранением и экран «Опубликовано» — часть 2 (2.1.4).
// Обработка фото идёт в очереди (queue:work в CI), фото показываются после неё.

const NBSP = ' ';
const TITLE = 'Fender American Vintage ’57 Stratocaster';
const missing = (page: import('@playwright/test').Page) =>
    page.getByText(/^Чтобы опубликовать, добавьте:/);

test.describe('UC-L1: заполнение формы «Продать инструмент»', () => {
    test('пустая форма, 3 фото, цена с форматированием и превью — до активной кнопки', async ({
        page,
    }) => {
        await signIn(page);
        await page.goto('/sell');

        await expect(
            page.getByRole('heading', { level: 1, name: 'Продать инструмент' }),
        ).toBeVisible();
        await expect(missing(page)).toHaveText(
            'Чтобы опубликовать, добавьте: модель, ещё 3 фото, фото серийного номера, состояние, цену.',
        );
        const publish = page.getByRole('button', { name: 'Опубликовать' });
        await expect(publish).toBeDisabled();

        // Шаг 1: вид, модель, год, серийный номер.
        await page.getByRole('radio', { name: 'Педали и усилители' }).click();
        await page.getByRole('radio', { name: 'Гитары' }).click();
        await page.getByRole('combobox', { name: 'Бренд и модель' }).fill(TITLE);
        await page.getByRole('textbox', { name: 'Год выпуска' }).fill('2009');
        await page.getByRole('textbox', { name: 'Серийный номер' }).fill('V091187');

        // Превью обновляется на лету.
        const preview = page.getByRole('complementary');
        await expect(preview.getByText(TITLE)).toBeVisible();

        // Шаг 3 и 4: состояние, пояснение, цена — буквы игнорируются.
        await page.getByRole('radio', { name: 'Отличное' }).click();
        await expect(page.getByText('Мелкие следы, заметные только вблизи.')).toBeVisible();
        const price = page.getByRole('textbox', { name: 'Цена' });
        await price.pressSequentially('abc184500');
        await expect(price).toHaveValue(`184${NBSP}500`);
        await expect(preview.getByText(/^184\s500\s₽$/)).toBeVisible();

        // Шаг 2: фото. При 2 фото над кнопкой «ещё 1 фото».
        await addPhoto(page, 'Серийный номер', 1);
        await expect(page.getByRole('img', { name: 'Фото серийного номера' })).toBeVisible({
            timeout: 15_000,
        });
        await addPhoto(page, 'Общий вид', 2);
        await expect(page.getByRole('img', { name: 'Фото 2' })).toBeVisible({ timeout: 15_000 });
        await expect(missing(page)).toHaveText('Чтобы опубликовать, добавьте: ещё 1 фото.');
        await expect(publish).toBeDisabled();

        await addPhoto(page, 'Корпус крупно', 3);
        await expect(page.getByRole('img', { name: 'Фото 3' })).toBeVisible({ timeout: 15_000 });
        await expect(missing(page)).toHaveCount(0);
        await expect(publish).toBeEnabled();

        // В превью — обычное фото, а не серийный номер.
        await expect(preview.locator('img')).toHaveAttribute(
            'src',
            /\/media\/photos\/\d+\/square\.webp/,
        );

        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        const serious = axe.violations.filter(
            (v) => v.impact === 'serious' || v.impact === 'critical',
        );
        expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual(
            [],
        );

        // Отправка: данные записаны в черновик (публикация — 2.1.4).
        await publish.click();
        await expect(page.getByText('Данные сохранены в черновике')).toBeVisible();
    });

    test('сервер отклоняет неполный запрос, отправленный в обход клиента', async ({ page }) => {
        await signIn(page);
        await page.goto('/sell');

        const response = await page.request.post('/sell', {
            data: { title: 'Fender', price: -5 },
            headers: { 'X-XSRF-TOKEN': await xsrf(page), Accept: 'application/json' },
        });

        expect(response.status()).toBe(422);
        const errors = ((await response.json()) as { errors: Record<string, string[]> }).errors;
        expect(Object.keys(errors)).toEqual(
            expect.arrayContaining(['listing_id', 'category_id', 'title', 'condition', 'price']),
        );
    });

    test('на 390 и 320 px нет горизонтальной прокрутки, зоны нажатия не меньше 44 px', async ({
        page,
    }) => {
        await signIn(page);
        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 844 });
            await page.goto('/sell');
            await expect(
                page.getByRole('heading', { level: 1, name: 'Продать инструмент' }),
            ).toBeVisible();

            const overflow = await page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
            );
            expect(overflow, `${width} px`).toBeLessThanOrEqual(0);

            for (const name of ['Гитары', 'Новое', 'Встреча в Москве', 'Опубликовать']) {
                const box = await page
                    .getByRole(name === 'Опубликовать' ? 'button' : 'radio', { name })
                    .or(page.getByRole('button', { name }))
                    .first()
                    .boundingBox();
                expect(box?.height ?? 0, `${name} @${width}`).toBeGreaterThanOrEqual(44);
            }
        }
    });
});
