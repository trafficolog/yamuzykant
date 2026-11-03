import type { Page } from '@playwright/test';

/**
 * Эталоны `header` и `footer` — отдельные блоки на белом поле 1440×900 (прототипы «Шапка» и «Подвал»).
 * Реализация — одна страница в PublicLayout, поэтому для сверки скрываем остальные части каркаса:
 * остаётся только сравниваемый блок, как в прототипе.
 */
export async function keepOnly(page: Page, keep: 'header' | 'footer'): Promise<void> {
    await page.evaluate((kept) => {
        for (const part of document.querySelectorAll<HTMLElement>(
            'body header, body main, body footer',
        )) {
            if (part.tagName.toLowerCase() !== kept) part.style.display = 'none';
        }
    }, keep);
}
