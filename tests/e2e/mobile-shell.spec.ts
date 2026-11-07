import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Мобильная оболочка (6.1.1): шапка в две строки, нижняя панель, меню категорий шторкой.
// Эталона header@390 нет (SCREENS.md, решение OWNER 03.11.2026): приёмка по чек-листу §3 —
// 320 px без прокрутки, зона нажатия ≥ 44 px, порядок блоков, MobileTabBar на < 640 px, axe.
// footer@390 сверяет tests/e2e/visual/footer.spec.ts. Снимки реализации (SHOTS_DIR или вложения
// отчёта) нужны для приёмки на гейте рядом с мобильным UI-китом ДС.

const seriousOrCritical = async (page: Page) => {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    return result.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => `${violation.id}: ${violation.nodes.map((n) => n.target).join(' | ')}`);
};

const open = async (page: Page, width: number, height = 844) => {
    await page.setViewportSize({ width, height });
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('networkidle');
};

const rect = async (locator: Locator) => {
    const box = await locator.boundingBox();
    if (!box) throw new Error('Элемент не отрисован');
    return box;
};

const header = (page: Page) => page.getByRole('banner');
const tabBar = (page: Page) => page.getByRole('navigation', { name: 'Нижнее меню' });
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Все категории' });

const WIDTHS = [320, 390];

test.describe('Мобильная шапка: порядок и размеры', () => {
    test('390 px: Wordmark и город в первой строке, поиск и «Категории» — во второй', async ({
        page,
    }) => {
        await open(page, 390);

        const logo = await rect(header(page).getByRole('link', { name: 'ЯМузыкант' }));
        const city = await rect(header(page).getByRole('button', { name: 'Москва' }));
        const search = await rect(header(page).getByRole('search'));
        const cats = await rect(header(page).getByRole('button', { name: 'Категории' }));

        // Первая строка: логотип слева, город правее на той же линии.
        expect(Math.abs(logo.y + logo.height / 2 - (city.y + city.height / 2))).toBeLessThan(4);
        expect(city.x).toBeGreaterThan(logo.x + logo.width);
        // Вторая строка: «Категории», затем поиск на всю оставшуюся ширину; ниже первой строки.
        expect(search.y).toBeGreaterThanOrEqual(logo.y + logo.height - 1);
        expect(Math.abs(search.y - cats.y)).toBeLessThan(2);
        expect(search.x).toBeGreaterThan(cats.x + cats.width - 1);
        expect(search.x + search.width).toBeGreaterThan(390 - 24);
    });

    test('390 px: строки разделов, «Продать инструмент» и «Войти» скрыты (роль берёт панель)', async ({
        page,
    }) => {
        await open(page, 390);

        await expect(page.getByRole('navigation', { name: 'Разделы' })).toBeHidden();
        await expect(header(page).getByRole('link', { name: 'Продать инструмент' })).toBeHidden();
        await expect(header(page).getByRole('button', { name: 'Войти' })).toBeHidden();
    });

    test('390 px: «Категории» — квадратная кнопка 48 px, имя сохраняется', async ({ page }) => {
        await open(page, 390);

        const cats = header(page).getByRole('button', { name: 'Категории' });
        const box = await cats.boundingBox();
        expect(box?.width).toBe(48);
        expect(box?.height).toBe(48);
    });

    for (const width of WIDTHS) {
        test(`${width} px: все кнопки и ссылки шапки и панели не меньше 44 px`, async ({
            page,
        }) => {
            await open(page, width);

            const small = await page.evaluate(() =>
                [...document.querySelectorAll('header button, header a, nav.ym-tabbar a')]
                    .map((el) => ({ el, box: el.getBoundingClientRect() }))
                    .filter(({ box }) => box.width > 0 && box.height > 0)
                    .filter(({ box }) => box.height < 44 || box.width < 44)
                    .map(
                        ({ el, box }) =>
                            `${el.textContent?.trim() ?? el.tagName}: ${box.width}×${box.height}`,
                    ),
            );

            expect(small).toEqual([]);
        });
    }
});

test.describe('MobileTabBar на < 640 px', () => {
    test('639 px: панель видна, 640 px и 1440 px: скрыта', async ({ page }) => {
        await open(page, 639);
        await expect(tabBar(page)).toBeVisible();

        await open(page, 640);
        await expect(tabBar(page)).toBeHidden();

        await open(page, 1440, 900);
        await expect(tabBar(page)).toBeHidden();
    });

    test('390 px: пять вкладок в порядке карточки, панель у нижнего края окна', async ({
        page,
    }) => {
        await open(page, 390, 844);

        await expect(tabBar(page).locator('a, button')).toHaveText([
            'Главная',
            'Поиск',
            'Продать',
            'Сообщения',
            'Кабинет',
        ]);
        const box = await rect(tabBar(page));
        expect(box.y + box.height).toBeCloseTo(844, 0);
        expect(box.width).toBe(390);
    });

    test('панель остаётся у нижнего края и на длинной странице, подвал не перекрыт', async ({
        page,
    }) => {
        await open(page, 390, 500);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

        const bar = await rect(tabBar(page));
        const footer = await rect(page.getByRole('contentinfo'));
        expect(bar.y + bar.height).toBeCloseTo(500, 0);
        expect(footer.y + footer.height).toBeLessThanOrEqual(bar.y + 1);
    });

    test('390 px: вкладки делят ширину поровну', async ({ page }) => {
        await open(page, 390);

        const widths = await tabBar(page)
            .locator('a, button')
            .evaluateAll((links) =>
                links.map((link) => Math.round(link.getBoundingClientRect().width)),
            );
        expect(new Set(widths).size).toBe(1);
    });

    test('320 px: подписи вкладок не обрезаны', async ({ page }) => {
        await open(page, 320);

        const clipped = await tabBar(page)
            .locator('a, button')
            .evaluateAll((links) =>
                links
                    .filter((link) =>
                        [...link.querySelectorAll('span')].some(
                            (s) => s.scrollWidth > s.clientWidth,
                        ),
                    )
                    .map((link) => link.textContent),
            );
        expect(clipped).toEqual([]);
    });

    test('«Главная» на главной странице отмечена текущей', async ({ page }) => {
        await open(page, 390);

        await expect(tabBar(page).getByRole('link', { name: 'Главная' })).toHaveAttribute(
            'aria-current',
            'page',
        );
    });

    test('Tab-порядок: шапка, содержимое, подвал, затем нижняя панель', async ({ page }) => {
        await open(page, 390);

        const order = await page.evaluate(() => {
            const bar = document.querySelector('nav.ym-tabbar');
            const footer = document.querySelector('footer');
            return Boolean(
                bar &&
                footer &&
                footer.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING,
            );
        });
        expect(order).toBe(true);
    });

    test('сервер отдаёт нижнюю панель в HTML без JS (SSR)', async ({ request }) => {
        const html = await (await request.get('/')).text();

        expect(html).toContain('aria-label="Нижнее меню"');
    });
});

test.describe('Меню категорий — полноэкранная шторка', () => {
    test('390 px: шторка закрывает весь экран, включая нижнюю панель', async ({ page }) => {
        await open(page, 390, 844);
        await page.getByRole('button', { name: 'Категории' }).click();

        await expect(sheet(page)).toBeVisible();
        const box = await sheet(page).boundingBox();
        expect(box).toEqual({ x: 0, y: 0, width: 390, height: 844 });

        const covered = await page.evaluate(() => {
            const bar = (
                document.querySelector('nav.ym-tabbar') as Element
            ).getBoundingClientRect();
            const top = document.elementFromPoint(bar.x + bar.width / 2, bar.y + bar.height / 2);
            return top?.closest('.ym-site-menu') !== null;
        });
        expect(covered).toBe(true);
    });

    test('390 px: виды → группы вида → назад → закрыть; фокус возвращается на «Категории»', async ({
        page,
    }) => {
        await open(page, 390);
        await page.getByRole('button', { name: 'Категории' }).click();

        await expect(sheet(page).getByRole('button', { name: 'Гитары' })).toBeVisible();
        await expect(sheet(page).getByRole('link', { name: /Педали эффектов/ })).toBeHidden();

        await sheet(page).getByRole('button', { name: 'Педали и усилители' }).click();
        await expect(sheet(page).getByRole('link', { name: /Педали эффектов/ })).toBeVisible();
        await expect(sheet(page).getByRole('button', { name: 'Гитары' })).toBeHidden();

        await sheet(page).getByRole('button', { name: 'Все категории' }).click();
        await expect(sheet(page).getByRole('button', { name: 'Гитары' })).toBeVisible();

        await sheet(page).getByRole('button', { name: 'Закрыть меню' }).click();
        await expect(sheet(page)).toBeHidden();
        await expect(page.getByRole('button', { name: 'Категории' })).toBeFocused();
    });

    test('390 px: Esc закрывает шторку', async ({ page }) => {
        await open(page, 390);
        await page.getByRole('button', { name: 'Категории' }).click();
        await expect(sheet(page)).toBeVisible();

        await page.keyboard.press('Escape');

        await expect(sheet(page)).toBeHidden();
    });

    test('390 px: пока шторка открыта, страница под ней не прокручивается', async ({ page }) => {
        await open(page, 390);
        await page.getByRole('button', { name: 'Категории' }).click();

        const overflow = await page.evaluate(() => getComputedStyle(document.body).overflowY);
        expect(overflow).toBe('hidden');
    });

    test('390 px: кнопки и строки шторки не меньше 44 px', async ({ page }) => {
        await open(page, 390);
        await page.getByRole('button', { name: 'Категории' }).click();
        await sheet(page).getByRole('button', { name: 'Гитары' }).click();

        const small = await page.evaluate(() =>
            [...document.querySelectorAll('.ym-site-menu button, .ym-site-menu a')]
                .map((el) => ({ el, box: el.getBoundingClientRect() }))
                .filter(({ box }) => box.width > 0 && box.height > 0 && box.height < 44)
                .map(({ el, box }) => `${el.textContent?.trim()}: ${box.height}`),
        );
        expect(small).toEqual([]);
    });

    test('640 px и шире: меню остаётся выпадающим, без кнопки «Закрыть меню»', async ({ page }) => {
        await open(page, 1440, 900);
        await page.getByRole('button', { name: 'Категории' }).click();

        const panel = page.locator('#site-category-menu');
        await expect(panel).toBeVisible();
        await expect(panel).not.toHaveAttribute('role', 'dialog');
        await expect(panel.getByRole('button', { name: 'Закрыть меню' })).toBeHidden();
        const box = await rect(panel);
        expect(box.y).toBeGreaterThan(0);
    });
});

test.describe('Мобильная оболочка: узкие экраны (чек-лист SCREENS §3)', () => {
    for (const width of WIDTHS) {
        test(`${width} px: нет горизонтальной прокрутки, включая панель и открытую шторку`, async ({
            page,
        }) => {
            await open(page, width);

            const overflowOf = () =>
                page.evaluate(() => {
                    const limit = document.documentElement.clientWidth;
                    const wide = [...document.querySelectorAll('body *')]
                        .filter((el) => el.getBoundingClientRect().width > 0)
                        .filter((el) => {
                            for (let node: Element | null = el; node; node = node.parentElement) {
                                if (['auto', 'scroll'].includes(getComputedStyle(node).overflowX))
                                    return false;
                            }
                            return el.getBoundingClientRect().right > limit + 0.5;
                        })
                        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className)}`);
                    return { scrollWidth: document.documentElement.scrollWidth, limit, wide };
                });

            const closed = await overflowOf();
            expect(closed.scrollWidth).toBeLessThanOrEqual(closed.limit);
            expect(closed.wide).toEqual([]);

            await page.getByRole('button', { name: 'Категории' }).click();
            await sheet(page).getByRole('button', { name: 'Гитары' }).click();
            const opened = await overflowOf();
            expect(opened.scrollWidth).toBeLessThanOrEqual(opened.limit);
            expect(opened.wide).toEqual([]);
        });

        test(`${width} px: axe без нарушений serious и critical (панель, шторка)`, async ({
            page,
        }) => {
            await open(page, width);
            expect(await seriousOrCritical(page)).toEqual([]);

            await page.getByRole('button', { name: 'Категории' }).click();
            await expect(sheet(page)).toBeVisible();
            expect(await seriousOrCritical(page)).toEqual([]);

            await sheet(page).getByRole('button', { name: 'Гитары' }).click();
            expect(await seriousOrCritical(page)).toEqual([]);
        });
    }

    test('focus-visible: у вкладок панели при Tab есть видимое кольцо фокуса', async ({ page }) => {
        await open(page, 390);

        const links = tabBar(page).locator('a, button');
        const missing: string[] = [];
        for (let index = 0; index < 5; index++) {
            await links.nth(index).focus();
            await page.keyboard.press('Shift+Tab');
            await page.keyboard.press('Tab');
            const ring = await links.nth(index).evaluate((el) => {
                const style = getComputedStyle(el);
                return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
            });
            if (!ring) missing.push(String(await links.nth(index).textContent()));
        }
        expect(missing).toEqual([]);
    });
});

// Снимки реализации для приёмки OWNER рядом с мобильным UI-китом ДС (design/ds/ui_kits/marketplace/mobile.html).
test.describe('Снимки реализации', () => {
    for (const width of WIDTHS) {
        test(`снимки ${width} px`, async ({ page }, testInfo) => {
            await open(page, width);
            const dir = process.env.SHOTS_DIR;
            if (dir) mkdirSync(dir, { recursive: true });

            const shoot = async (name: string, options: { fullPage: boolean }) => {
                const body = await page.screenshot({ ...options, animations: 'disabled' });
                await testInfo.attach(`${name}@${width}`, { body, contentType: 'image/png' });
                if (dir) {
                    const { writeFileSync } = await import('node:fs');
                    writeFileSync(join(dir, `${name}@${width}.png`), body);
                }
            };

            await shoot('mobile-home', { fullPage: false });
            await shoot('mobile-home-full', { fullPage: true });
            await page.getByRole('button', { name: 'Категории' }).click();
            await shoot('mobile-menu-list', { fullPage: false });
            await sheet(page).getByRole('button', { name: 'Гитары' }).click();
            await shoot('mobile-menu-panel', { fullPage: false });
        });
    }
});
