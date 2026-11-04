import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// PublicLayout (0.2.4): шапка и подвал на главной. Флаги вне MVP выключены (R1), поэтому в строке
// разделов только «Барахолка». Окружение: см. playwright.config.ts (сервер, SSR, прототипы).

const seriousOrCritical = async (page: Page) => {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    return result.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => `${violation.id}: ${violation.nodes.map((n) => n.target).join(' | ')}`);
};

const openHome = async (page: Page, width = 1440, height = 900) => {
    await page.setViewportSize({ width, height });
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('networkidle');
};

test.describe('PublicLayout: каркас', () => {
    test('шапка, main и подвал — ориентиры страницы, h1 один', async ({ page }) => {
        await openHome(page);

        await expect(page.getByRole('banner')).toBeVisible();
        await expect(page.getByRole('main')).toBeVisible();
        await expect(page.getByRole('contentinfo')).toBeVisible();
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    });

    test('skip-link первым получает фокус по Tab, виден и переводит к main', async ({ page }) => {
        await openHome(page);

        await page.keyboard.press('Tab');
        const skip = page.getByRole('link', { name: 'Перейти к содержимому' });
        await expect(skip).toBeFocused();
        await expect(skip).toBeInViewport();

        await page.keyboard.press('Enter');
        await expect(page.getByRole('main')).toBeFocused();
    });

    test('сервер отдаёт шапку и подвал в HTML без JS (SSR)', async ({ request }) => {
        const html = await (await request.get('/')).text();

        expect(html).toContain('aria-label="Разделы"');
        expect(html).toContain('Продать инструмент');
        expect(html).toContain('ym-footer');
    });
});

test.describe('PublicLayout: шапка', () => {
    test('кнопки и поиск в шапке одной высоты 48 px', async ({ page }) => {
        await openHome(page);
        const header = page.getByRole('banner');

        const controls = {
            categories: header.getByRole('button', { name: 'Категории' }),
            search: header.getByRole('search'),
            city: header.getByRole('button', { name: 'Москва' }),
            sell: header.getByRole('link', { name: 'Продать инструмент' }),
            login: header.getByRole('button', { name: 'Войти' }),
        };

        for (const [name, locator] of Object.entries(controls)) {
            const box = await locator.boundingBox();
            expect(box?.height, name).toBe(48);
        }
    });

    test('в строке разделов при выключенных флагах только «Барахолка»', async ({ page }) => {
        await openHome(page);

        const links = page.getByRole('navigation', { name: 'Разделы' }).getByRole('link');
        await expect(links).toHaveText(['Барахолка']);
    });

    test('меню категорий: Enter открывает, Tab входит в меню, Esc закрывает и возвращает фокус', async ({
        page,
    }) => {
        await openHome(page);
        const toggle = page.getByRole('button', { name: 'Категории' });
        const menu = page.locator('#site-category-menu');

        await toggle.focus();
        await page.keyboard.press('Enter');
        await expect(menu).toBeVisible();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');

        await page.keyboard.press('Tab');
        await expect(menu.getByRole('button', { name: 'Гитары' })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(menu.getByRole('button', { name: 'Педали и усилители' })).toBeFocused();
        await expect(menu.getByRole('link', { name: /Педали эффектов/ })).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(menu).toBeHidden();
        await expect(toggle).toBeFocused();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    test('меню категорий: Space тоже открывает', async ({ page }) => {
        await openHome(page);

        await page.getByRole('button', { name: 'Категории' }).focus();
        await page.keyboard.press('Space');

        await expect(page.locator('#site-category-menu')).toBeVisible();
    });

    test('меню категорий: клик вне меню закрывает, клик внутри нет', async ({ page }) => {
        await openHome(page);
        const menu = page.locator('#site-category-menu');

        await page.getByRole('button', { name: 'Категории' }).click();
        await expect(menu).toBeVisible();

        await menu.getByRole('button', { name: 'Ударные' }).click();
        await expect(menu).toBeVisible();

        await page.mouse.click(720, 880);
        await expect(menu).toBeHidden();
    });

    test('меню категорий: наведение на вид переключает панель', async ({ page }) => {
        await openHome(page);

        await page.getByRole('button', { name: 'Категории' }).click();
        const menu = page.locator('#site-category-menu');
        await menu.getByRole('button', { name: 'Студия и запись' }).hover();

        await expect(menu.getByRole('link', { name: /Микрофоны/ })).toBeVisible();
    });
});

test.describe('PublicLayout: состояния', () => {
    test('focus-visible: у каждого элемента шапки при Tab есть видимое кольцо фокуса', async ({
        page,
    }) => {
        await openHome(page);

        const missing: string[] = [];
        // skip-link, раздел, три иконки, логотип, категории, поиск (поле и «Найти»), город, продать, войти
        for (let stop = 0; stop < 12; stop++) {
            await page.keyboard.press('Tab');
            const state = await page.evaluate(() => {
                const el = document.activeElement;
                if (!el || el === document.body) return { name: 'body', ring: false };
                const own = getComputedStyle(el);
                const group = el.closest('.ym-search');
                const wrapped = group ? getComputedStyle(group) : null;
                const ring = (s: CSSStyleDeclaration) =>
                    s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
                return {
                    name: (el.getAttribute('aria-label') ?? el.textContent ?? el.tagName).trim(),
                    ring: ring(own) || (wrapped !== null && ring(wrapped)),
                };
            });
            if (!state.ring) missing.push(state.name);
        }

        expect(missing).toEqual([]);
    });

    test('hover: строка меню категорий подсвечивается, активная остаётся выделенной', async ({
        page,
    }) => {
        await openHome(page);
        await page.getByRole('button', { name: 'Категории' }).click();
        const menu = page.locator('#site-category-menu');
        const row = menu.getByRole('button', { name: 'Духовые' });

        const before = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
        await row.hover();
        const after = await row.evaluate((el) => getComputedStyle(el).backgroundColor);

        expect(after).not.toBe(before);
        await expect(row).toHaveAttribute('aria-current', 'true');
    });
});

test.describe('PublicLayout: доступность', () => {
    test('axe: страница с закрытым меню без нарушений serious и critical', async ({ page }) => {
        await openHome(page);

        expect(await seriousOrCritical(page)).toEqual([]);
    });

    test('axe: открытое меню категорий без нарушений serious и critical', async ({ page }) => {
        await openHome(page);
        await page.getByRole('button', { name: 'Категории' }).click();
        await expect(page.locator('#site-category-menu')).toBeVisible();

        expect(await seriousOrCritical(page)).toEqual([]);
    });

    test('axe: мобильная ширина 390 px без нарушений serious и critical', async ({ page }) => {
        await openHome(page, 390, 844);

        expect(await seriousOrCritical(page)).toEqual([]);
    });
});

test.describe('PublicLayout: узкие экраны (чек-лист SCREENS §3)', () => {
    for (const width of [320, 390]) {
        test(`${width} px: нет горизонтальной прокрутки, шапка и подвал помещаются`, async ({
            page,
        }) => {
            await openHome(page, width, 800);

            const overflow = await page.evaluate(() => {
                const limit = document.documentElement.clientWidth;
                const scrolls = (el: Element | null): boolean => {
                    for (let node = el; node && node !== document.body; node = node.parentElement) {
                        const style = getComputedStyle(node);
                        if (['auto', 'scroll'].includes(style.overflowX)) return true;
                    }
                    return false;
                };
                const wide = [...document.querySelectorAll('header *, footer *')]
                    .filter((el) => !scrolls(el))
                    .filter((el) => el.getBoundingClientRect().right > limit + 0.5)
                    .map((el) => `${el.tagName.toLowerCase()}.${String(el.className)}`);
                return { scrollWidth: document.documentElement.scrollWidth, limit, wide };
            });

            expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.limit);
            expect(overflow.wide).toEqual([]);
        });
    }

    test('390 px: зона нажатия кнопок и ссылок шапки не меньше 44 px', async ({ page }) => {
        await openHome(page, 390, 844);

        const small = await page.evaluate(() =>
            [...document.querySelectorAll('header button, header a')]
                .map((el) => ({ el, box: el.getBoundingClientRect() }))
                .filter(({ box }) => box.width > 0 && box.height > 0 && box.height < 44)
                .map(({ el, box }) => `${el.textContent?.trim() ?? el.tagName}: ${box.height}`),
        );

        expect(small).toEqual([]);
    });
});
