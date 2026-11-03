import type { Page } from '@playwright/test';
import { findForbidden } from '../../tools/copy-dictionary.mjs';

/** Атрибуты, текст которых видит пользователь или скринридер, но не видит `innerText`. */
export const ATTRIBUTES = ['title', 'placeholder', 'aria-label', 'alt'] as const;

export interface CopyPiece {
    /** `text` — отрисованный текст страницы, иначе имя атрибута. */
    source: 'text' | (typeof ATTRIBUTES)[number];
    value: string;
}

export interface ForbiddenHit {
    word: string;
    hint: string;
    source: CopyPiece['source'];
}

/** Тексты страницы: `document.body.innerText` и значения атрибутов всех элементов (в том числе скрытых). */
export async function collectCopy(page: Page): Promise<CopyPiece[]> {
    return page.evaluate((attributes) => {
        const pieces: { source: string; value: string }[] = [
            { source: 'text', value: document.body.innerText },
        ];
        for (const attribute of attributes) {
            for (const element of document.querySelectorAll(`[${attribute}]`)) {
                const value = element.getAttribute(attribute)?.trim();
                if (value) pieces.push({ source: attribute, value });
            }
        }
        return pieces;
    }, ATTRIBUTES) as Promise<CopyPiece[]>;
}

/** Запрещённые слова (AGENTS.md §5) в каждом куске по отдельности, с указанием источника. */
export function forbiddenIn(pieces: CopyPiece[]): ForbiddenHit[] {
    return pieces.flatMap((piece) =>
        findForbidden(piece.value).map((hit) => ({ ...hit, source: piece.source })),
    );
}
