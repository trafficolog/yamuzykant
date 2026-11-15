import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AccountOverview from '@/Pages/Account/Overview';

// 1.1.3: «Обзор» — блоки «Покупаю» и «Продаю» из того, что уже есть (сообщения, объявления).

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({
        props: { auth: { user: { id: 1, name: 'Анна', city: null, is_staff: false } } },
    }),
    Head: () => null,
}));

type Props = React.ComponentProps<typeof AccountOverview>;

const view = (props: Partial<Props> = {}) =>
    render(
        <AccountOverview
            buying={{ unread_chats: 2, favorites: 4 }}
            selling={{ active_listings: 3, unread_chats: 1 }}
            {...props}
        />,
    );

describe('Account/Overview', () => {
    it('приветствует по имени', () => {
        view();

        expect(
            screen.getByRole('heading', { level: 2, name: 'Здравствуйте, Анна' }),
        ).toBeInTheDocument();
    });

    it('блок «Покупаю»: непрочитанные чаты по чужим объявлениям — ссылка на сообщения', () => {
        view();

        const block = screen.getByRole('region', { name: 'Покупаю' });
        const link = within(block).getByRole('link', { name: /Непрочитанные чаты/ });
        expect(link).toHaveAttribute('href', '/messages');
        expect(link).toHaveTextContent('2');
        expect(within(block).getByText('по чужим объявлениям')).toBeInTheDocument();
    });

    it('блок «Продаю»: активные объявления и непрочитанные чаты по своим', () => {
        view();

        const block = screen.getByRole('region', { name: 'Продаю' });
        expect(within(block).getByText('Активные объявления').closest('div')).toHaveTextContent(
            '3',
        );
        expect(within(block).getByRole('link', { name: /Непрочитанные чаты/ })).toHaveTextContent(
            '1',
        );
        expect(within(block).getByText('по вашим объявлениям')).toBeInTheDocument();
    });

    it('блок «Покупаю»: плитка «Избранное» (4.3.1) — число и ссылка на вкладку', () => {
        view();

        const block = screen.getByRole('region', { name: 'Покупаю' });
        const link = within(block).getByRole('link', { name: /Избранное/ });
        expect(link).toHaveAttribute('href', '/account/favorites');
        expect(link).toHaveTextContent('4');
    });

    it('сохранённых поисков пока нет: плитки для них нет', () => {
        view();

        expect(screen.queryByText('Сохранённые поиски')).toBeNull();
    });
});
