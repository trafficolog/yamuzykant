import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { addPhoto, signIn, xsrf } from './_seller';

// UC-L1 «Подать объявление».
// Часть 1 — заполнение формы (2.1.3): 4 шага, превью ListingCard, список недостающего над кнопкой,
// серверная проверка в обход клиента.
// Часть 2 — публикация (2.1.4): черновик с автосохранением и восстановлением, «Сохранить черновик»,
// «Опубликовать» → экран «Объявление опубликовано», двойной клик, контакты в описании, объявление в Барахолке.
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

        // Отправка: публикация (премодерация выключена) → экран «Объявление опубликовано».
        await publish.click();
        await expect(
            page.getByRole('heading', { level: 2, name: 'Объявление опубликовано' }),
        ).toBeVisible();
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

            for (const name of ['Гитары', 'Новое', 'Встреча в г. Москва', 'Опубликовать']) {
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

/** Загружает 3 фото (первое — серийный номер) и ждёт, пока они обработаются. */
async function addThreePhotos(page: Page): Promise<void> {
    await addPhoto(page, 'Серийный номер', 1);
    await expect(page.getByRole('img', { name: 'Фото серийного номера' })).toBeVisible({
        timeout: 15_000,
    });
    await addPhoto(page, 'Общий вид', 2);
    await expect(page.getByRole('img', { name: 'Фото 2' })).toBeVisible({ timeout: 15_000 });
    await addPhoto(page, 'Корпус крупно', 3);
    await expect(page.getByRole('img', { name: 'Фото 3' })).toBeVisible({ timeout: 15_000 });
}

/** Заполняет обязательные поля формы: уникальное название, состояние, цена. */
async function fillRequired(page: Page, title: string): Promise<void> {
    await page.getByRole('combobox', { name: 'Бренд и модель' }).fill(title);
    await page.getByRole('radio', { name: 'Отличное' }).click();
    await page.getByRole('textbox', { name: 'Цена' }).fill('184500');
}

const uniqueTitle = () => `Harley Benton ST-${Date.now()}${Math.floor(Math.random() * 1000)}`;

test.describe('UC-L1 часть 2: черновик и публикация (2.1.4)', () => {
    test('перезагрузка восстанавливает черновик с фото; автосохранение — через 5 с', async ({
        page,
    }) => {
        await signIn(page);
        await page.goto('/sell');
        await addThreePhotos(page);

        await page.getByRole('combobox', { name: 'Бренд и модель' }).fill(TITLE);
        await page.getByRole('textbox', { name: 'Год выпуска' }).fill('2009');
        await page.getByRole('radio', { name: 'Отличное' }).click();
        await page.getByRole('textbox', { name: 'Описание' }).fill('Родной кейс.');
        await page.getByRole('textbox', { name: 'Цена' }).fill('184500');
        await page.getByRole('button', { name: 'Договорная' }).click();

        // Автосохранение: без нажатия кнопок, ждём запрос сохранения.
        await page.waitForResponse(
            (response) => response.url().endsWith('/sell/draft') && response.status() === 200,
            { timeout: 12_000 },
        );

        await page.reload();

        await expect(page.getByRole('combobox', { name: 'Бренд и модель' })).toHaveValue(TITLE);
        await expect(page.getByRole('textbox', { name: 'Год выпуска' })).toHaveValue('2009');
        await expect(page.getByRole('textbox', { name: 'Описание' })).toHaveValue('Родной кейс.');
        await expect(page.getByRole('radio', { name: 'Отличное' })).toHaveAttribute(
            'aria-checked',
            'true',
        );
        await expect(page.getByRole('button', { name: 'Договорная' })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        await expect(page.getByRole('img', { name: 'Фото серийного номера' })).toBeVisible();
        await expect(page.getByRole('img', { name: 'Фото 3' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Опубликовать' })).toBeEnabled();
    });

    test('«Сохранить черновик» сохраняет сразу, без публикации; уход со страницы тоже сохраняет', async ({
        page,
    }) => {
        await signIn(page);
        await page.goto('/sell');

        await page.getByRole('combobox', { name: 'Бренд и модель' }).fill('Fender Telecaster');
        await page.getByRole('button', { name: 'Сохранить черновик' }).click();
        await expect(page.getByText(/^Черновик сохранён/)).toBeVisible();

        await page.reload();
        await expect(page.getByRole('combobox', { name: 'Бренд и модель' })).toHaveValue(
            'Fender Telecaster',
        );

        // Уход со страницы раньше, чем сработал таймер, не теряет правку.
        await page.getByRole('textbox', { name: 'Описание' }).fill('Ушёл раньше таймера');
        await page.goto('/');
        await page.goto('/sell');
        await expect(page.getByRole('textbox', { name: 'Описание' })).toHaveValue(
            'Ушёл раньше таймера',
        );
    });

    test('двойной клик «Опубликовать» создаёт одно объявление; оно в Барахолке не позже 60 с', async ({
        page,
    }) => {
        await signIn(page);
        await page.goto('/sell');
        const title = uniqueTitle();
        await addThreePhotos(page);
        await fillRequired(page, title);

        await page.getByRole('button', { name: 'Опубликовать' }).dblclick();

        await expect(
            page.getByRole('heading', { level: 2, name: 'Объявление опубликовано' }),
        ).toBeVisible();
        await expect(page.getByText(title)).toBeVisible();
        await expect(page.getByRole('link', { name: 'Открыть объявление' })).toHaveAttribute(
            'href',
            /\/listings\/[0-9a-f-]{36}$/,
        );

        // «Продать ещё один» — снова пустая форма (новый черновик).
        await page.getByRole('link', { name: 'Продать ещё один' }).click();
        await expect(page).toHaveURL(/\/sell$/);
        await expect(page.getByRole('combobox', { name: 'Бренд и модель' })).toHaveValue('');

        // Барахолка: выдача обновляется очередью индексации.
        await expect
            .poll(
                async () => {
                    const response = await page.request.get(
                        `/baraholka?q=${encodeURIComponent(title)}`,
                    );
                    return (await response.text()).includes(title);
                },
                { timeout: 60_000, intervals: [1_000, 2_000, 5_000] },
            )
            .toBe(true);
    });

    test('контакты в описании блокируют публикацию с подсказкой у поля', async ({ page }) => {
        await signIn(page);
        await page.goto('/sell');
        await addThreePhotos(page);
        await fillRequired(page, uniqueTitle());
        await page
            .getByRole('textbox', { name: 'Описание' })
            .fill('Отличная гитара, звоните +7 916 123-45-67');

        await page.getByRole('button', { name: 'Опубликовать' }).click();

        await expect(
            page.getByText(
                'Уберите телефон из описания — покупатели напишут вам в сообщениях.',
            ),
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { level: 2, name: 'Объявление опубликовано' }),
        ).toHaveCount(0);
    });

    test('экран «Объявление опубликовано»: axe без serious и critical, 390 px без горизонтальной прокрутки', async ({
        page,
    }) => {
        await signIn(page);
        await page.goto('/sell');
        await addThreePhotos(page);
        await fillRequired(page, uniqueTitle());
        await page.getByRole('button', { name: 'Опубликовать' }).click();
        await expect(
            page.getByRole('heading', { level: 2, name: 'Объявление опубликовано' }),
        ).toBeVisible();

        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        const serious = axe.violations.filter(
            (v) => v.impact === 'serious' || v.impact === 'critical',
        );
        expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual(
            [],
        );

        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 844 });
            const overflow = await page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
            );
            expect(overflow, `${width} px`).toBeLessThanOrEqual(0);
            for (const name of ['Открыть объявление', 'Продать ещё один']) {
                const box = await page.getByRole('link', { name }).boundingBox();
                expect(box?.height ?? 0, `${name} @${width}`).toBeGreaterThanOrEqual(44);
            }
        }
    });

    test('сервер: сохранение черновика в обход клиента отклоняет чужой черновик и слишком длинное название', async ({
        page,
    }) => {
        await signIn(page);
        await page.goto('/sell');

        const response = await page.request.put('/sell/draft', {
            data: {
                listing_id: '00000000-0000-4000-8000-000000000000',
                title: 'a'.repeat(121),
            },
            headers: { 'X-XSRF-TOKEN': await xsrf(page), Accept: 'application/json' },
        });

        expect(response.status()).toBe(422);
        const errors = ((await response.json()) as { errors: Record<string, string[]> }).errors;
        expect(Object.keys(errors)).toEqual(expect.arrayContaining(['listing_id', 'title']));
    });
});
