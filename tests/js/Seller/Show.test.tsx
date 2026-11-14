import { render, screen, within } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import SellerShow, { type SellerShowProps } from '@/Pages/Seller/Show';

// 3.1.6: страница продавца. Шапка: имя, «на ЯМузыканте с …», город с типом, число продаж; вкладки «В продаже» /
// «Продано» (без цен); «Пожаловаться» — после 5.2.1; времени ответа нет (данных нет).

vi.mock('@inertiajs/react', () => ({
    Link: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
    Head: ({ children }: { children?: ReactNode }) => <>{children}</>,
    usePage: () => ({ props: {} }),
}));

const base: SellerShowProps = {
    seller: { id: 7, name: 'Гитарный угол', city: { type: 'г.', name: 'Москва' }, since: 2025 },
    tab: 'sale',
    counts: { sale: 2, sold: 9 },
    listings: [
        {
            id: 'lot-1',
            title: 'Fender Stratocaster',
            price: 184_500,
            condition: 'excellent',
            city: 'Москва',
            ship: false,
            negotiable: true,
            posted: '3 дня назад',
            image: null,
        },
        {
            id: 'lot-2',
            title: 'Boss DS-1',
            price: null,
            condition: 'good',
            city: 'Москва',
            ship: true,
            negotiable: false,
            posted: 'вчера',
            image: null,
        },
    ],
    sold: [],
    pagination: { page: 1, pages: 1 },
};

describe('Seller/Show', () => {
    it('шапка: имя, город с типом, «на ЯМузыканте с …», число продаж', () => {
        render(<SellerShow {...base} />);

        expect(screen.getByRole('heading', { level: 1, name: 'Гитарный угол' })).toBeTruthy();
        expect(screen.getByText('г. Москва')).toBeTruthy();
        expect(screen.getByText('На ЯМузыканте с 2025')).toBeTruthy();
        expect(screen.getByText('9 продаж')).toBeTruthy();
    });

    it('без города и года эти факты не выводятся; «0 продаж» не пишем', () => {
        render(
            <SellerShow
                {...base}
                seller={{ ...base.seller, city: null, since: null }}
                counts={{ sale: 2, sold: 0 }}
            />,
        );

        expect(screen.queryByText(/На ЯМузыканте с/)).toBeNull();
        expect(screen.queryByText(/продаж/)).toBeNull();
    });

    it('вкладки — ссылки со счётчиками, активная помечена aria-current', () => {
        render(<SellerShow {...base} />);

        const tabs = screen.getByRole('navigation', { name: 'Разделы продавца' });
        const sale = within(tabs).getByRole('link', { name: /В продаже/ });
        const sold = within(tabs).getByRole('link', { name: /Продано/ });
        expect(sale.getAttribute('href')).toBe('/sellers/7');
        expect(sale.getAttribute('aria-current')).toBe('page');
        expect(sale.textContent).toContain('2');
        expect(sold.getAttribute('href')).toBe('/sellers/7?tab=sold');
        expect(sold.getAttribute('aria-current')).toBeNull();
        expect(sold.textContent).toContain('9');
    });

    it('«В продаже»: карточки ведут на лоты, цена по BR-11', () => {
        render(<SellerShow {...base} />);

        const grid = screen.getByRole('list', { name: 'Объявления продавца' });
        const links = within(grid).getAllByRole('link');
        expect(links.map((link) => link.getAttribute('href'))).toEqual(
            expect.arrayContaining(['/listings/lot-1', '/listings/lot-2']),
        );
        expect(screen.getByText('Договорная')).toBeTruthy();
    });

    it('«Продано»: название, город и когда; цен и ссылок нет', () => {
        render(
            <SellerShow
                {...base}
                tab="sold"
                listings={[]}
                sold={[{ id: 'old-1', title: 'Gibson Les Paul', city: 'Москва', sold: '3 окт' }]}
            />,
        );

        const list = screen.getByRole('list', { name: 'Проданные объявления' });
        expect(within(list).getByText('Gibson Les Paul')).toBeTruthy();
        expect(within(list).getByText(/3 окт/)).toBeTruthy();
        expect(within(list).queryByRole('link')).toBeNull();
        expect(list.textContent).not.toMatch(/₽/);
    });

    it('нет объявлений — пустое состояние для вкладки', () => {
        const { unmount } = render(<SellerShow {...base} listings={[]} counts={{ sale: 0, sold: 0 }} />);
        expect(screen.getByText('Сейчас у продавца нет объявлений в продаже.')).toBeTruthy();
        unmount();

        render(<SellerShow {...base} tab="sold" listings={[]} counts={{ sale: 0, sold: 0 }} />);
        expect(screen.getByText('Проданных инструментов пока нет.')).toBeTruthy();
    });

    it('страницы: номера — ссылки с сохранением вкладки', () => {
        render(<SellerShow {...base} tab="sold" pagination={{ page: 1, pages: 2 }} />);

        const pager = screen.getByRole('navigation', { name: 'Страницы' });
        expect(within(pager).getByRole('link', { name: 'Страница 2' }).getAttribute('href')).toBe(
            '/sellers/7?tab=sold&page=2',
        );
    });

    it('«Пожаловаться» не выводится до задачи 5.2.1', () => {
        render(<SellerShow {...base} />);

        expect(screen.queryByText('Пожаловаться')).toBeNull();
    });
});
