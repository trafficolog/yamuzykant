import { render, screen, within } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

import Pagination from '@/Components/Pagination';

vi.mock('@inertiajs/react', () => ({
    Link: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

const href = (page: number) => `/baraholka?page=${page}`;
const nav = () => screen.getByRole('navigation', { name: 'Страницы' });
const labels = () =>
    within(nav())
        .getAllByRole('link')
        .map((a) => a.textContent);

describe('Pagination', () => {
    it('одна страница — ничего не рисует', () => {
        const { container } = render(<Pagination page={1} pages={1} href={href} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('номера страниц — настоящие ссылки (SEO), текущая помечена aria-current и не ссылка', () => {
        render(<Pagination page={2} pages={4} href={href} />);

        expect(within(nav()).getByRole('link', { name: 'Страница 3' })).toHaveAttribute(
            'href',
            '/baraholka?page=3',
        );
        const current = nav().querySelector('[aria-current="page"]');
        expect(current?.textContent).toBe('2');
        expect(current?.tagName).not.toBe('A');
    });

    it('«Назад» и «Вперёд» с rel=prev/next; на первой странице «Назад» нет, на последней нет «Вперёд»', () => {
        const { rerender } = render(<Pagination page={1} pages={3} href={href} />);
        expect(screen.queryByRole('link', { name: 'Назад' })).toBeNull();
        expect(screen.getByRole('link', { name: 'Вперёд' })).toHaveAttribute('rel', 'next');

        rerender(<Pagination page={3} pages={3} href={href} />);
        expect(screen.getByRole('link', { name: 'Назад' })).toHaveAttribute('rel', 'prev');
        expect(screen.queryByRole('link', { name: 'Вперёд' })).toBeNull();
    });

    it('много страниц: первая, последняя и соседи текущей, между ними многоточие', () => {
        render(<Pagination page={10} pages={20} href={href} />);

        expect(labels()).toEqual(['Назад', '1', '9', '11', '20', 'Вперёд']);
        expect(nav().textContent).toContain('…');
    });
});
