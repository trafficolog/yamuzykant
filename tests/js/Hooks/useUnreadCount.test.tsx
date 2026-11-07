import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUnreadCount } from '@/Hooks/useUnreadCount';
import { fakeEcho } from '../support/messages';

// 4.1.2: счётчик непрочитанных — из shared prop `messages.unread`, дальше живёт по событию `.unread.changed`
// канала private-user.{id}. Подписка одна на вкладку, сколько бы компонентов ни читали счётчик.

const fake = fakeEcho();
vi.mock('@/realtime/echo', () => ({ getEcho: () => fake.echo }));

let props: Record<string, unknown> = {};
vi.mock('@inertiajs/react', () => ({ usePage: () => ({ props }) }));

const REALTIME = { key: 'k', host: '127.0.0.1', port: 8080, scheme: 'http' };

function Probe({ id = 'probe' }: { id?: string }) {
    return <output data-testid={id}>{useUnreadCount()}</output>;
}

beforeEach(() => {
    props = { auth: { user: { id: 7 } }, messages: { unread: 3 }, realtime: REALTIME };
    fake.echo.private.mockClear();
    fake.echo.leave.mockClear();
});

describe('useUnreadCount', () => {
    it('стартует с shared prop messages.unread', () => {
        render(<Probe />);

        expect(screen.getByTestId('probe')).toHaveTextContent('3');
    });

    it('обновляется по .unread.changed на private-user.{id}', () => {
        render(<Probe />);

        expect(fake.echo.private).toHaveBeenCalledWith('user.7');
        act(() => fake.emit('.unread.changed', { unread: 5 }));

        expect(screen.getByTestId('probe')).toHaveTextContent('5');
    });

    it('новое значение shared prop (после перехода или перезагрузки) заменяет живое', () => {
        const { rerender } = render(<Probe />);
        act(() => fake.emit('.unread.changed', { unread: 5 }));

        props = { ...props, messages: { unread: 1 } };
        rerender(<Probe />);

        expect(screen.getByTestId('probe')).toHaveTextContent('1');
    });

    it('две копии хука — одна подписка, отписка только после ухода последней', () => {
        const { unmount } = render(
            <>
                <Probe id="a" />
                <Probe id="b" />
            </>,
        );

        expect(fake.echo.private).toHaveBeenCalledTimes(1);
        act(() => fake.emit('.unread.changed', { unread: 9 }));
        expect(screen.getByTestId('a')).toHaveTextContent('9');
        expect(screen.getByTestId('b')).toHaveTextContent('9');

        unmount();
        expect(fake.echo.leave).toHaveBeenCalledWith('user.7');
        expect(fake.echo.leave).toHaveBeenCalledTimes(1);
    });

    it('гость и страница без realtime: 0, подписки нет', () => {
        props = { auth: { user: null }, messages: null, realtime: null };
        render(<Probe />);

        expect(screen.getByTestId('probe')).toHaveTextContent('0');
        expect(fake.echo.private).not.toHaveBeenCalled();
    });

    it('вошедший без Reverb: счётчик из props, подписки нет', () => {
        props = { auth: { user: { id: 7 } }, messages: { unread: 4 }, realtime: null };
        render(<Probe />);

        expect(screen.getByTestId('probe')).toHaveTextContent('4');
        expect(fake.echo.private).not.toHaveBeenCalled();
    });

    it('мусор в событии не ломает счётчик', () => {
        render(<Probe />);

        act(() => fake.emit('.unread.changed', { unread: 'много' }));
        act(() => fake.emit('.unread.changed', null));

        expect(screen.getByTestId('probe')).toHaveTextContent('3');
    });
});
