import { fireEvent, render, screen, within } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

import AccountFavorites, { type FavoriteItem } from '@/Pages/Account/Favorites';

// 4.3.1, UC-S5: «Избранное» в кабинете. Снятое — плашка «Снято с продажи», без ссылки; снижение цены подсвечено.

const visit = vi.fn();

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({
        props: { auth: { user: { id: 1, name: 'Анна', city: null, is_staff: false } } },
    }),
    Head: () => null,
    Link: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
    router: { visit: (url: string) => visit(url), on: vi.fn() },
}));

vi.mock('@/lib/favoritesApi', () => ({ setFavorite: vi.fn().mockResolvedValue(200) }));

const available = (patch: Partial<Extract<FavoriteItem, { available: true }>> = {}): FavoriteItem => ({
    id: 'a1',
    title: 'Gibson Les Paul Studio 2014',
    price: 149_000,
    old_price: null,
    condition: 'very-good',
    city: 'Москва',
    ship: false,
    negotiable: false,
    posted: 'вчера',
    image: null,
    available: true,
    favorite: true,
    ...patch,
});

const gone: FavoriteItem = {
    id: 'g1',
    title: 'Ibanez RG550 Genesis',
    price: 96_000,
    available: false,
    favorite: true,
};

const view = (favorites: FavoriteItem[], pagination = { page: 1, pages: 1 }) =>
    render(<AccountFavorites favorites={favorites} pagination={pagination} />);

describe('Account/Favorites', () => {
    it('пусто: подсказка и переход в Барахолку', () => {
        view([]);

        expect(screen.getByText(/пока ничего нет/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Перейти в Барахолку' }));
        expect(visit).toHaveBeenCalledWith('/baraholka');
    });

    it('доступное объявление: карточка со ссылкой на лот и включённым сердцем', () => {
        view([available()]);

        const list = screen.getByRole('list', { name: 'Избранное' });
        const link = within(list).getByRole('link', { name: 'Gibson Les Paul Studio 2014' });
        expect(link).toHaveAttribute('href', '/listings/a1');
        expect(
            within(list).getByRole('button', { name: 'Убрать из избранного' }),
        ).toHaveAttribute('aria-pressed', 'true');
    });

    it('цена снизилась: прежняя цена и значок скидки', () => {
        view([available({ price: 90_000, old_price: 120_000 })]);

        expect(screen.getByText(/120\s000/)).toBeInTheDocument();
        expect(screen.getByText('−25%')).toBeInTheDocument();
    });

    it('без снижения цены прежней цены и значка нет', () => {
        view([available()]);

        expect(screen.queryByText(/−\d+%/)).toBeNull();
    });

    it('снятое с продажи: плашка «Снято с продажи», название и цена без ссылки', () => {
        view([gone]);

        expect(screen.getByText('Снято с продажи')).toBeInTheDocument();
        expect(screen.getByText('Ibanez RG550 Genesis')).toBeInTheDocument();
        expect(screen.getByText(/96\s000/)).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Ibanez/ })).toBeNull();
        expect(document.querySelector('a[href="/listings/g1"]')).toBeNull();
    });

    it('снятое можно убрать из избранного', () => {
        view([gone]);

        expect(screen.getByRole('button', { name: 'Убрать из избранного' })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
    });

    it('снятое с «Договорная» и «Бесплатно» показывает подпись, а не «0 ₽»', () => {
        view([
            { ...gone, id: 'g2', price: 0 },
            { ...gone, id: 'g3', price: null },
        ]);

        expect(screen.getByText('Бесплатно')).toBeInTheDocument();
        expect(screen.getByText('Договорная')).toBeInTheDocument();
        expect(screen.queryByText(/0\s₽/)).toBeNull();
    });

    it('страницы: ссылки на ?page', () => {
        view([available()], { page: 1, pages: 3 });

        expect(screen.getByRole('link', { name: 'Страница 2' })).toHaveAttribute(
            'href',
            '/account/favorites?page=2',
        );
    });
});
