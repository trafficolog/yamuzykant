import { fireEvent, render, screen } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import PricedListingCard from '@/Components/PricedListingCard';

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({
        props: { auth: { user: { id: 1, name: 'Анна', city: null, is_staff: false } } },
    }),
}));

const setFavorite = vi.fn().mockResolvedValue(200);
vi.mock('@/lib/favoritesApi', () => ({
    setFavorite: (id: string, next: boolean) => setFavorite(id, next),
}));

// BR-11, карточка 3.1.10: одна подпись цены для карточек Барахолки и лота. Слово — текстом в DOM
// (видно в SSR, Ctrl+F, скринридерам), визуально его рисует CSS из `--price-label`. Портала нет.

const base = { title: 'Fender Japan ST62, 1994', href: '/listings/1' };
const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
const readFile = (relative: string) => readFileSync(path(relative), 'utf8');

describe('PricedListingCard: подпись цены (BR-11)', () => {
    it('SSR: price = null — слово «Договорная» есть в HTML текстом', () => {
        const html = renderToString(<PricedListingCard {...base} price={null} />);

        expect(html).toMatch(/<span class="ym-sr">Договорная<\/span>/);
        expect(html).toMatch(/<span class="ym-price__now"><\/span>/);
    });

    it('SSR: price = 0 — слово «Бесплатно» в HTML, «0 ₽» нет', () => {
        const html = renderToString(<PricedListingCard {...base} price={0} />);

        expect(html).toMatch(/<span class="ym-sr">Бесплатно<\/span>/);
        expect(html).not.toMatch(/(^|[^\d])0\s₽/);
    });

    it('SSR: сумма — цена в блоке, подписи и --price-label нет', () => {
        const html = renderToString(<PricedListingCard {...base} price={184_500} />);

        expect(html).toMatch(/184\s500/);
        expect(html).not.toContain('--price-label');
        expect(html).not.toContain('Договорная');
        expect(html).not.toContain('Бесплатно');
    });

    it('в браузере: текст находится поиском по тексту, --price-label на обёртке', () => {
        const { container } = render(<PricedListingCard {...base} price={null} />);

        expect(screen.getByText('Договорная')).toBeInTheDocument();
        const wrapper = container.querySelector<HTMLElement>('.ym-priced-card');
        expect(wrapper?.style.getPropertyValue('--price-label')).toBe('"Договорная"');
    });

    it('одна реализация: портала и отдельных карточек Барахолки и лота нет', () => {
        expect(existsSync(path('../../../resources/js/Components/LotListingCard.tsx'))).toBe(false);
        expect(existsSync(path('../../../resources/js/Components/FleaListingCard.tsx'))).toBe(
            false,
        );
        expect(readFile('../../../resources/js/Components/PricedListingCard.tsx')).not.toContain(
            'createPortal',
        );
    });
});

describe('CSS: подпись цены и токены (3.1.10)', () => {
    const site = readFile('../../../resources/css/site.css');

    it('подпись цены задана один раз, без привязки к Барахолке', () => {
        expect(site).toMatch(/\.ym-priced-card \.ym-price__now:empty::after/);
        expect(readFile('../../../resources/css/flea.css')).not.toContain('--price-label');
    });

    it('токенов совместимости --lad* в flea.css и lot.css нет', () => {
        for (const file of ['flea.css', 'lot.css']) {
            expect(readFile(`../../../resources/css/${file}`)).not.toMatch(/--lad/);
        }
    });

    it.each(['aria-pressed', 'aria-checked'])(
        'контраст выбранного FilterChip (%s): счётчик непрозрачный, правила нет в account.css',
        (attribute) => {
            const style = document.createElement('style');
            style.textContent = readFile('../../../resources/js/ds/tokens/components.css') + site;
            document.head.append(style);
            document.body.innerHTML = `<button class="ym-chip" ${attribute}="true">Все<span class="ym-chip__count">3</span></button>`;

            const count = document.querySelector('.ym-chip__count') as HTMLElement;
            expect(getComputedStyle(count).opacity).toBe('1');

            style.remove();
            expect(readFile('../../../resources/css/account.css')).not.toMatch(/ym-chip__count/);
        },
    );

    it('hover выбранного чипа покрывает оба атрибута', () => {
        expect(site).toMatch(
            /\.ym-chip:is\(\[aria-pressed='true'\], \[aria-checked='true'\]\):hover:not\(\[disabled\]\)/,
        );
    });

    it('чипы Барахолки (FleaFilterPanel) — aria-pressed, их правило покрывает', () => {
        expect(readFile('../../../resources/js/ds/components/forms/FilterChip.jsx')).toContain(
            "a['aria-pressed']",
        );
        expect(site).toContain("[aria-pressed='true'], [aria-checked='true']");
    });

    it('в sell.css токенов --lad* нет', () => {
        expect(readFile('../../../resources/css/sell.css')).not.toMatch(/--lad/);
    });
});

// 4.3.1: сердце карточки ДС не умеет сообщать о клике (нет onToggle), поэтому его скрывает CSS, а поверх
// карточки стоит управляемое FavoriteToggle. Без listingId карточка прежняя.
describe('PricedListingCard: сердце «В избранное» (4.3.1)', () => {
    it('без listingId управляемого сердца нет', () => {
        const { container } = render(<PricedListingCard {...base} price={1000} />);

        expect(container.querySelector('.ym-fav-card__btn')).toBeNull();
    });

    it('с listingId: сердце по favorite, клик отправляет запрос', () => {
        const { container } = render(
            <PricedListingCard {...base} price={1000} listingId="lot-9" favorite />,
        );

        const button = container.querySelector('.ym-fav-card__btn button') as HTMLButtonElement;
        expect(button).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(button);

        expect(setFavorite).toHaveBeenCalledWith('lot-9', false);
    });

    it('сердце лежит рядом с карточкой, а не внутри её ссылок', () => {
        const { container } = render(
            <PricedListingCard {...base} price={1000} listingId="lot-9" favorite={false} />,
        );

        expect(container.querySelector('a .ym-fav-card__btn')).toBeNull();
        expect(container.querySelector('.ym-fav-card > .ym-fav-card__btn')).not.toBeNull();
    });
});
