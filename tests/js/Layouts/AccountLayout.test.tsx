import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AccountLayout from '@/Layouts/AccountLayout';

// 1.1.3: каркас кабинета — заголовок, навигация, «Покупаю» / «Продаю» (DEVIATIONS «account»).

let unread = 0;

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({
        props: {
            flags: {},
            city: null,
            auth: { user: { id: 1, name: 'Анна', city: null, is_staff: false } },
            messages: { unread },
        },
    }),
    Head: () => null,
    Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
    router: { visit: vi.fn(), on: vi.fn() },
}));

beforeEach(() => {
    unread = 0;
    window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
});

const nav = () => screen.getByRole('navigation', { name: 'Разделы кабинета' });

describe('AccountLayout', () => {
    it('заголовок «Кабинет» и навигация внутри main', () => {
        render(
            <AccountLayout active="profile">
                <p>Содержимое</p>
            </AccountLayout>,
        );

        const main = screen.getByRole('main');
        expect(
            within(main).getByRole('heading', { level: 1, name: 'Кабинет' }),
        ).toBeInTheDocument();
        expect(within(main).getByText('Содержимое')).toBeInTheDocument();
        expect(main).toContainElement(nav());
    });

    it('вкладки по готовым задачам: Обзор, Избранное, Объявления, Сообщения, Профиль; выбранная — aria-current', () => {
        render(<AccountLayout active="profile">{null}</AccountLayout>);

        const links = within(nav()).getAllByRole('link');
        expect(links.map((link) => [link.textContent?.trim(), link.getAttribute('href')])).toEqual([
            ['Обзор', '/account'],
            ['Избранное', '/account/favorites'],
            ['Объявления', '/account/listings'],
            ['Сообщения', '/messages'],
            ['Профиль', '/account/profile'],
        ]);
        expect(within(nav()).getByRole('link', { name: 'Профиль' })).toHaveAttribute(
            'aria-current',
            'page',
        );
        expect(within(nav()).getByRole('link', { name: 'Обзор' })).not.toHaveAttribute(
            'aria-current',
        );
    });

    it('«Избранное» — в группе «Покупаю», «Объявления» — в группе «Продаю»', () => {
        render(<AccountLayout active="favorites">{null}</AccountLayout>);

        const buy = within(nav()).getByRole('list', { name: 'Покупаю' });
        expect(within(buy).getByRole('link', { name: 'Избранное' })).toHaveAttribute(
            'aria-current',
            'page',
        );
        const sell = within(nav()).getByRole('list', { name: 'Продаю' });
        expect(within(sell).getByRole('link', { name: 'Объявления' })).toBeInTheDocument();
    });

    it('когда разделы групп готовы, группы подписаны и содержат свои вкладки', () => {
        render(
            <AccountLayout
                active="overview"
                sections={{ favorites: '/account/favorites', listings: '/account/listings' }}
            >
                {null}
            </AccountLayout>,
        );

        const buy = within(nav()).getByRole('list', { name: 'Покупаю' });
        const sell = within(nav()).getByRole('list', { name: 'Продаю' });
        expect(
            within(buy)
                .getAllByRole('link')
                .map((l) => l.textContent?.trim()),
        ).toEqual(['Избранное']);
        expect(
            within(sell)
                .getAllByRole('link')
                .map((l) => l.textContent?.trim()),
        ).toEqual(['Объявления']);
    });

    it('счётчик непрочитанных у «Сообщений» входит в имя ссылки', () => {
        unread = 3;
        render(<AccountLayout active="overview">{null}</AccountLayout>);

        expect(within(nav()).getByRole('link', { name: 'Сообщения, 3' })).toBeInTheDocument();
    });
});
