import { act, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PublicLayout from '@/Layouts/PublicLayout';
import { fakeEcho } from '../support/messages';

// 4.1.2: счётчик непрочитанных в шапке и на вкладке нижней панели берётся из shared prop `messages.unread`
// и обновляется по событию канала без перезагрузки страницы.

const fake = fakeEcho();
vi.mock('@/realtime/echo', () => ({ getEcho: () => fake.echo }));

let props: Record<string, unknown> = {};
vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props }),
    Head: () => null,
    router: { visit: vi.fn(), on: vi.fn() },
}));

const REALTIME = { key: 'k', host: '127.0.0.1', port: 8080, scheme: 'http' };

beforeEach(() => {
    props = {
        flags: {},
        city: null,
        auth: { user: { id: 7, name: 'Анна', city: null, is_staff: false } },
        messages: { unread: 3 },
        realtime: REALTIME,
    };
    fake.echo.private.mockClear();
});

const header = () => screen.getByRole('banner');
const bar = () => screen.getByRole('navigation', { name: 'Нижнее меню' });

describe('PublicLayout: непрочитанные сообщения', () => {
    it('счётчик из shared prop — в шапке и на вкладке, обе ссылки ведут на /messages', () => {
        render(<PublicLayout>{null}</PublicLayout>);

        const top = within(header()).getByRole('link', { name: 'Сообщения, 3' });
        const tab = within(bar()).getByRole('link', { name: 'Сообщения, 3' });
        expect(top).toHaveAttribute('href', '/messages');
        expect(tab).toHaveAttribute('href', '/messages');
    });

    it('событие .unread.changed обновляет оба счётчика', () => {
        render(<PublicLayout>{null}</PublicLayout>);

        act(() => fake.emit('.unread.changed', { unread: 8 }));

        expect(within(header()).getByRole('link', { name: 'Сообщения, 8' })).toBeInTheDocument();
        expect(within(bar()).getByRole('link', { name: 'Сообщения, 8' })).toBeInTheDocument();
    });

    it('счётчик ушёл в 0 — значок пропадает', () => {
        render(<PublicLayout>{null}</PublicLayout>);

        act(() => fake.emit('.unread.changed', { unread: 0 }));

        expect(within(header()).getByRole('link', { name: 'Сообщения' })).toBeInTheDocument();
    });

    it('страница вкладки «Сообщения» отмечает её текущей', () => {
        render(<PublicLayout tab="messages">{null}</PublicLayout>);

        expect(bar().querySelector('[aria-current="page"]')).toHaveTextContent('Сообщения');
    });

    it('явно переданный messages сильнее shared prop (страницы-витрины, тесты)', () => {
        render(<PublicLayout messages={11}>{null}</PublicLayout>);

        expect(within(header()).getByRole('link', { name: 'Сообщения, 11' })).toBeInTheDocument();
    });

    it('гость: счётчика нет, канал не открывается', () => {
        props = { flags: {}, city: null, auth: { user: null }, messages: null, realtime: null };
        render(<PublicLayout>{null}</PublicLayout>);

        expect(within(header()).getByRole('link', { name: 'Сообщения' })).toBeInTheDocument();
        expect(fake.echo.private).not.toHaveBeenCalled();
    });
});
