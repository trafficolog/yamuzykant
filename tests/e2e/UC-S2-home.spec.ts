import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { hydrated } from './_hydrated';

// UC-S2 «Найти объявление запросом или по категории», главная (карточка 3.1.4, BR-01): рельсы свежих
// объявлений города шапки. Данные — FleaDemoSeeder (tests/e2e/global-setup.ts): 27 объявлений в Москве
// (14 из них «готовы к торгу»), 1 в Казани, в остальных городах пусто.

// Заглушка «Фото» карточки ДС (.ym-placeholder) не проходит контраст до правки токена в репозитории ДС
// (решение OWNER 07.11.2026, G1.md); исключение убрать после ds:sync.
const seriousOrCritical = async (page: Page) => {
    const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .exclude('.ym-placeholder')
        .analyze();
    return result.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => `${violation.id}: ${violation.nodes.map((n) => n.target).join(' | ')}`);
};

async function chooseCity(page: Page, query: string, name: string) {
    await page.getByRole('banner').getByRole('button', { name: 'Москва' }).click();
    const panel = page.getByRole('dialog', { name: 'Выбор города' });
    await panel.getByRole('searchbox', { name: 'Поиск города' }).fill(query);
    await panel.getByRole('button', { name: name }).click();
}

test.describe('UC-S2: главная', () => {
    test('рельсы «Новые в г. Москва» и «Готовы к торгу»: по 10 карточек города шапки', async ({
        page,
    }) => {
        await page.goto('/');

        const fresh = page.getByRole('region', { name: 'Новые в г. Москва' });
        await expect(fresh.getByRole('article')).toHaveCount(10);
        const negotiable = page.getByRole('region', { name: 'Готовы к торгу' });
        await expect(negotiable.getByRole('article')).toHaveCount(10);
        await expect(page.getByText('Gibson Les Paul Казань')).toHaveCount(0);
    });

    test('«Вся Барахолка» и «Все готовые к торгу» открывают выдачу', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('link', { name: 'Вся Барахолка' }).click();
        await expect(page).toHaveURL(/\/baraholka$/);

        await page.goto('/');
        await page.getByRole('link', { name: 'Все готовые к торгу' }).click();
        await expect(page).toHaveURL(/\/baraholka\?negotiable=1$/);
        await expect(page.getByRole('heading', { level: 1, name: 'Барахолка' })).toBeVisible();
    });

    test('категория с главной открывает /baraholka/{категория}', async ({ page }) => {
        await page.goto('/');
        await page
            .getByRole('navigation', { name: 'Виды инструментов' })
            .getByRole('link', { name: /Гитары/ })
            .click();

        await expect(page).toHaveURL(/\/baraholka\/gitary$/);
        await expect(page.getByRole('heading', { level: 1, name: 'Гитары' })).toBeVisible();
    });

    test('поиск из шапки открывает выдачу с запросом', async ({ page }) => {
        await page.goto('/');
        const search = page.getByRole('banner').getByRole('searchbox');
        await search.fill('Telecaster');
        await search.press('Enter');

        await expect(page).toHaveURL(/\/baraholka\?q=Telecaster/);
        await expect(page.getByRole('article')).toHaveCount(1);
    });

    test('смена города в шапке меняет рельсы', async ({ page }) => {
        await hydrated(page, '/');
        await chooseCity(page, 'Казан', 'Казань');

        const fresh = page.getByRole('region', { name: 'Новые в г. Казань' });
        await expect(fresh.getByRole('article')).toHaveCount(1);
        await expect(page.getByRole('region', { name: 'Новые в г. Москва' })).toHaveCount(0);
    });

    test('город без объявлений: вместо рельсов сообщение и выбор другого города', async ({
        page,
    }) => {
        await hydrated(page, '/');
        await chooseCity(page, 'Самар', 'Самара');

        await expect(page.getByText('В г. Самара пока нет объявлений.')).toBeVisible();
        await expect(page.getByRole('article')).toHaveCount(0);
        await expect(page.getByRole('heading', { level: 2, name: /^Новые в/ })).toHaveCount(0);

        await page.getByRole('button', { name: 'Выбрать другой город' }).click();
        await expect(page.getByRole('dialog', { name: 'Выбор города' })).toBeVisible();
    });

    test('«Продать инструмент» для гостя открывает окно входа', async ({ page }) => {
        await page.goto('/');
        await page
            .getByRole('region', { name: 'Продать инструмент' })
            .getByRole('link', { name: 'Продать инструмент' })
            .click();

        await expect(page.getByRole('dialog', { name: 'Вход', exact: true })).toBeVisible();
    });

    test('рельсы и категории есть в HTML без JS-рендера (SSR)', async ({ request }) => {
        const html = await (await request.get('/')).text();

        expect(html).toContain('Новые в г. Москва');
        expect(html).toContain('Гитара демо');
        expect(html).toContain('href="/baraholka/gitary"');
    });

    test('axe: нет нарушений serious и critical', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        expect(await seriousOrCritical(page)).toEqual([]);
    });

    for (const width of [320, 390]) {
        test(`${width} px: без горизонтальной прокрутки, зона нажатия категорий не меньше 44 px`, async ({
            page,
        }) => {
            await page.setViewportSize({ width, height: 800 });
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            const metrics = await page.evaluate(() => ({
                scrollWidth: document.documentElement.scrollWidth,
                clientWidth: document.documentElement.clientWidth,
            }));
            expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);

            const links = page
                .getByRole('navigation', { name: 'Виды инструментов' })
                .getByRole('link');
            for (const link of await links.all()) {
                const box = await link.boundingBox();
                expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
            }
        });
    }
});
