import type { Page } from '@playwright/test';

/**
 * Эталоны `header` и `footer` — отдельные блоки на белом поле 1440×900 (прототипы «Шапка» и «Подвал»).
 * Реализация — одна страница в PublicLayout, поэтому для сверки скрываем остальные части каркаса:
 * остаётся только сравниваемый блок, как в прототипе.
 */
export async function keepOnly(page: Page, keep: 'header' | 'footer'): Promise<void> {
    // Страница могла отрисоваться на клиенте уже после события load (enableAllFlags): ждём все части.
    for (const part of ['header', 'main', 'footer']) {
        await page.locator(`body ${part}`).waitFor({ state: 'attached' });
    }
    await page.evaluate((kept) => {
        for (const part of document.querySelectorAll<HTMLElement>(
            'body header, body main, body footer',
        )) {
            if (part.tagName.toLowerCase() !== kept) part.style.display = 'none';
        }
    }, keep);
}

/**
 * Прототипы «Шапка» и «Подвал» нарисованы без класса `.ym-root`, поэтому у них `box-sizing: content-box`:
 * элементы с рамкой и min-height (чипы, кнопки) выше на 2 px. В приложении `.ym-root` стоит на корне
 * (так задумана ДС, кнопки и поиск 48 px), и подвал на 390 px получается на 6 px ниже эталона.
 * Эта функция убирает класс, чтобы сверить остальную композицию с эталоном.
 */
export async function withPrototypeBoxModel(page: Page): Promise<void> {
    await page.evaluate(() => document.querySelector('.ym-root')?.classList.remove('ym-root'));
}

const escapeAttr = (value: string): string =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');

const unescapeAttr = (value: string): string =>
    value
        .replaceAll('&quot;', '"')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&amp;', '&');

/**
 * Включает все флаги вне MVP на странице «/» только в этом тесте: подменяет shared prop `flags` в ответе
 * сервера и убирает SSR-разметку, чтобы клиент отрисовал страницу сам. Нужна, когда эталон нарисован
 * с разделами вне MVP (прототипы «Шапка», «Подвал»), а реализация в R1 их скрывает флагами и поэтому
 * отличается размером. Состояние R1 (флаги выключены) проверяют остальные тесты.
 */
export async function enableAllFlags(page: Page): Promise<void> {
    await page.route(
        (url) => url.pathname === '/',
        async (route) => {
            if (route.request().resourceType() !== 'document') return route.continue();

            const response = await route.fetch();
            const html = await response.text();
            const patched = html.replace(
                /<div id="app" data-page="([^"]*)">[\s\S]*<\/div>(\s*<\/body>)/,
                (_match, attr: string, tail: string) => {
                    const data = JSON.parse(unescapeAttr(attr)) as {
                        props: { flags?: Record<string, boolean> };
                    };
                    const flags = data.props.flags ?? {};
                    data.props.flags = Object.fromEntries(Object.keys(flags).map((k) => [k, true]));
                    return `<div id="app" data-page="${escapeAttr(JSON.stringify(data))}"></div>${tail}`;
                },
            );
            if (patched === html)
                throw new Error('Не удалось подменить флаги: нет #app с data-page');

            await route.fulfill({ response, body: patched });
        },
    );
}
