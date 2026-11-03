// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Мобильная оболочка (6.1.1): то, что в jsdom не проверить поведением, — правила site.css.
// Раскладку на реальных экранах проверяет tests/e2e/mobile-shell.spec.ts.
const css = readFileSync(
    fileURLToPath(new URL('../../../resources/css/site.css', import.meta.url)),
    'utf8',
);

/** Делит файл на тела блоков `@media (max-width: 639px) { … }` и всё остальное. */
function split(): { mobile: string; base: string } {
    const mobile: string[] = [];
    const base: string[] = [];
    let from = 0;
    for (;;) {
        const start = css.indexOf('@media (max-width: 639px)', from);
        if (start === -1) break;
        const open = css.indexOf('{', start);
        let depth = 0;
        let end = open;
        for (; end < css.length; end++) {
            if (css[end] === '{') depth++;
            if (css[end] === '}' && --depth === 0) break;
        }
        base.push(css.slice(from, start));
        mobile.push(css.slice(open + 1, end));
        from = end + 1;
    }
    base.push(css.slice(from));
    return { mobile: mobile.join('\n'), base: base.join('\n') };
}

const mobileBlocks = (): string => split().mobile;

const ruleBody = (source: string, selector: string): string => {
    const escaped = selector.replace(/[.[\]()]/g, '\\$&');
    const match = new RegExp(`(?:^|[}\\s,])${escaped}\\s*(?:,[^{}]*)?\\{([^}]*)\\}`, 'm').exec(
        source,
    );
    return match?.[1] ?? '';
};

describe('site.css: мобильная оболочка', () => {
    it('нижняя панель скрыта по умолчанию и показывается только на < 640 px', () => {
        expect(ruleBody(split().base, '.ym-tabbar')).toMatch(/display:\s*none/);
        expect(ruleBody(mobileBlocks(), '.ym-tabbar')).toMatch(/display:\s*flex/);
    });

    it('нижняя панель прижата к низу и учитывает safe-area', () => {
        const rule = ruleBody(mobileBlocks(), '.ym-tabbar');

        expect(rule).toMatch(/position:\s*sticky/);
        expect(rule).toMatch(/bottom:\s*0/);
        expect(rule).toContain('env(safe-area-inset-bottom)');
    });

    it('вкладки панели не уже 44 px и делят ширину поровну', () => {
        const rule = ruleBody(mobileBlocks(), '.ym-tabbar__item');

        expect(rule).toContain('var(--hit-min)');
        expect(rule).toMatch(/flex:\s*1 1 0/);
        expect(rule).toMatch(/min-width:\s*min-content/);
    });

    it('верхняя строка шапки (разделы, иконки) на < 640 px скрыта: её роль берёт нижняя панель', () => {
        expect(ruleBody(mobileBlocks(), '.ym-site-header__strip')).toMatch(/display:\s*none/);
    });

    it('«Продать инструмент» и «Войти» в шапке на < 640 px скрыты, остаётся город', () => {
        const hidden = ruleBody(mobileBlocks(), '.ym-site-header__actions > :not(:first-child)');

        expect(hidden).toMatch(/display:\s*none/);
    });

    it('меню категорий на < 640 px занимает весь экран', () => {
        const rule = ruleBody(mobileBlocks(), '.ym-site-menu');

        expect(rule).toMatch(/position:\s*fixed/);
        expect(rule).toMatch(/inset:\s*0/);
    });

    it('пока шторка открыта, страница под ней не прокручивается', () => {
        expect(mobileBlocks()).toMatch(/body:has\(\.ym-site-menu\)\s*\{[^}]*overflow:\s*hidden/);
    });

    it('верхняя панель шторки и кнопка «Назад» на широких экранах скрыты', () => {
        const base = split().base;

        expect(ruleBody(base, '.ym-site-menu__bar')).toMatch(/display:\s*none/);
        expect(ruleBody(base, '.ym-site-menu__back')).toMatch(/display:\s*none/);
    });

    it('верхняя панель шторки учитывает safe-area сверху (вырез iPhone)', () => {
        expect(ruleBody(mobileBlocks(), '.ym-site-menu__bar')).toContain(
            'env(safe-area-inset-top)',
        );
    });

    it('цвета только из токенов: ни hex, ни rgb в мобильных правилах', () => {
        expect(mobileBlocks()).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
        expect(mobileBlocks().length).toBeGreaterThan(0);
    });
});
