import { fireEvent, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import FleaListingCard from '@/Components/FleaListingCard';

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({
        props: { auth: { user: { id: 1, name: 'Анна', city: null, is_staff: false } } },
    }),
}));

const setFavorite = vi.fn().mockResolvedValue(200);
vi.mock('@/lib/favoritesApi', () => ({
    setFavorite: (id: string, next: boolean) => setFavorite(id, next),
}));

// BR-11, карточка 3.1.9: подпись цены задаёт CSS (`--price-label` + `:empty::after`), поэтому она есть
// в серверной разметке и работает без JS. Портала и useLayoutEffect в карточке больше нет.

const base = { title: 'Fender Japan ST62, 1994', href: '/listings/1' };

describe('FleaListingCard: подпись цены без JS', () => {
    it('SSR: price = null — «Договорная» в --price-label, блок цены пуст', () => {
        const html = renderToString(<FleaListingCard {...base} price={null} />);

        expect(html).toContain('--price-label:&quot;Договорная&quot;');
        expect(html).toMatch(/<span class="ym-price__now"><\/span>/);
    });

    it('SSR: price = 0 — «Бесплатно», «0 ₽» нет', () => {
        const html = renderToString(<FleaListingCard {...base} price={0} />);

        expect(html).toContain('--price-label:&quot;Бесплатно&quot;');
        expect(html).not.toMatch(/(^|[^\d])0\s₽/);
    });

    it('SSR: сумма — цена в блоке, --price-label не задан', () => {
        const html = renderToString(<FleaListingCard {...base} price={184_500} />);

        expect(html).toMatch(/184\s500/);
        expect(html).not.toContain('--price-label');
    });

    it('в браузере то же значение на обёртке, без портала в блок цены', () => {
        const { container } = render(<FleaListingCard {...base} price={null} />);

        const wrapper = container.querySelector<HTMLElement>('.ym-flea__card');
        expect(wrapper?.style.getPropertyValue('--price-label')).toBe('"Договорная"');
        expect(container.querySelector('.ym-price__now')?.textContent).toBe('');
    });
});

// 4.3.1: сердце карточки ДС не умеет сообщать о клике (нет onToggle), поэтому его скрывает CSS, а поверх
// карточки стоит управляемое FavoriteToggle. Без listingId карточка прежняя.
describe('FleaListingCard: сердце «В избранное» (4.3.1)', () => {
    it('без listingId управляемого сердца нет', () => {
        const { container } = render(<FleaListingCard {...base} price={1000} />);

        expect(container.querySelector('.ym-fav-card__btn')).toBeNull();
    });

    it('с listingId: сердце по favorite, клик отправляет запрос', () => {
        const { container } = render(
            <FleaListingCard {...base} price={1000} listingId="lot-9" favorite />,
        );

        const button = container.querySelector('.ym-fav-card__btn button') as HTMLButtonElement;
        expect(button).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(button);

        expect(setFavorite).toHaveBeenCalledWith('lot-9', false);
    });

    it('сердце лежит рядом с карточкой, а не внутри её ссылок', () => {
        const { container } = render(
            <FleaListingCard {...base} price={1000} listingId="lot-9" favorite={false} />,
        );

        expect(container.querySelector('a .ym-fav-card__btn')).toBeNull();
        expect(container.querySelector('.ym-fav-card > .ym-fav-card__btn')).not.toBeNull();
    });
});
