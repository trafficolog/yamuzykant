import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MessagesIndex from '@/Pages/Messages/Index';
import { VIEWER, conversation, fakeEcho, json, listItem, message } from '../support/messages';

// 4.1.2: страница «Сообщения» — список слева, переписка справа; на < 640 px по одной панели.

const fake = fakeEcho();
vi.mock('@/realtime/echo', () => ({ getEcho: (config: unknown) => (config ? fake.echo : null) }));

const { visit, reload } = vi.hoisted(() => ({ visit: vi.fn(), reload: vi.fn() }));
let pageProps: Record<string, unknown> = {};

vi.mock('@inertiajs/react', () => ({
    router: { visit, reload },
    usePage: () => ({ props: pageProps, url: '/messages' }),
    Head: () => null,
}));

const REALTIME = { key: 'k', host: '127.0.0.1', port: 8080, scheme: 'http' };
const fetchMock = vi.fn();

type Props = ComponentProps<typeof MessagesIndex>;

const LIST: Props['conversations'] = [
    listItem('c1', { unread: 1 }),
    listItem('c2', { role: 'selling', counterpart: { name: 'Ирина С.', deleted: false } }),
];

function view(props: Partial<Props> = {}) {
    const merged: Props = { conversations: LIST, active: null, compose: null, ...props };
    pageProps = {
        auth: { user: { id: VIEWER, name: 'Анна', city: null, is_staff: false } },
        messages: { unread: 1 },
        realtime: REALTIME,
        ...merged,
    };
    return render(<MessagesIndex {...merged} />);
}

const root = () => document.querySelector('[data-view]') as HTMLElement;

beforeEach(() => {
    visit.mockReset();
    reload.mockReset();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => json({ unread: 0 }));
    vi.stubGlobal('fetch', fetchMock);
    fake.echo.private.mockClear();
});

describe('Messages/Index', () => {
    it('один заголовок первого уровня «Сообщения», список и переписка — регионы', () => {
        view();

        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Сообщения');
        expect(screen.getByRole('region', { name: 'Список чатов' })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Переписка' })).toBeInTheDocument();
    });

    it('чат не выбран: справа подсказка «Выберите чат слева», на телефоне виден список', () => {
        view();

        expect(screen.getByText(/Выберите чат слева/)).toBeInTheDocument();
        expect(root()).toHaveAttribute('data-view', 'list');
        expect(screen.queryByRole('log')).toBeNull();
    });

    it('чатов нет совсем: пустое состояние списка и подсказка справа', () => {
        view({ conversations: [] });

        expect(screen.getByText('Здесь пока нет чатов.')).toBeInTheDocument();
        expect(screen.getByText(/Выберите чат слева|Откройте объявление/)).toBeInTheDocument();
    });

    it('открытая беседа: переписка справа, строка списка отмечена, на телефоне виден чат', () => {
        view({
            active: {
                conversation: conversation({ id: 'c1' }),
                messages: [message(1, 'Здравствуйте', false)],
                has_more: false,
            },
        });

        expect(root()).toHaveAttribute('data-view', 'thread');
        const thread = screen.getByRole('region', { name: 'Переписка' });
        expect(within(thread).getByText('Здравствуйте')).toBeInTheDocument();
        const current = within(screen.getByRole('list', { name: 'Чаты' })).getAllByRole('link')[0];
        expect(current).toHaveAttribute('aria-current', 'true');
    });

    it('клик по строке открывает беседу частичным переходом: состояние списка сохраняется, список в запрос не входит', () => {
        view();

        fireEvent.click(
            within(screen.getByRole('list', { name: 'Чаты' })).getAllByRole(
                'link',
            )[1] as HTMLElement,
        );

        expect(visit).toHaveBeenCalledWith(
            '/messages/c2',
            expect.objectContaining({
                only: ['active', 'compose'],
                preserveState: true,
                preserveScroll: true,
            }),
        );
    });

    it('«Закрыть чат» возвращает к списку', () => {
        view({
            active: { conversation: conversation({ id: 'c1' }), messages: [], has_more: false },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Закрыть чат' }));

        expect(visit).toHaveBeenCalledWith(
            '/messages',
            expect.objectContaining({
                only: ['active', 'compose'],
                preserveState: true,
            }),
        );
    });

    // 3.1.11: обновление списка во время перехода панели шло с прежнего адреса — Inertia отбрасывает такой ответ,
    // и превью в списке оставалось старым (UC-D1 на main). Обновление ждёт конца перехода и уходит после него.
    it('событие счётчика во время перехода панели: список обновляется после перехода, а не с прежнего адреса', () => {
        view({
            active: { conversation: conversation({ id: 'c1' }), messages: [], has_more: false },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Закрыть чат' }));
        const options = visit.mock.calls.at(-1)?.[1] as { onFinish: () => void };

        act(() => fake.emit('.unread.changed', { unread: 4 }));
        expect(reload).not.toHaveBeenCalled();

        act(() => options.onFinish());
        expect(reload).toHaveBeenCalledTimes(1);
        expect(reload).toHaveBeenCalledWith(
            expect.objectContaining({ only: ['conversations', 'messages'] }),
        );
    });

    // 0.2.9: переход панели несёт только панель, поэтому запрос списка, ушедший ДО клика, отменяется визитом
    // (Inertia отменяет запрос в полёте) и должен повториться после перехода.
    it('reload списка в полёте, клик по панели: после конца перехода reload повторяется', () => {
        view({
            active: { conversation: conversation({ id: 'c1' }), messages: [], has_more: false },
        });
        act(() => fake.emit('.unread.changed', { unread: 4 }));
        expect(reload).toHaveBeenCalledTimes(1);
        (reload.mock.calls[0]?.[0] as { onStart: () => void }).onStart();

        fireEvent.click(screen.getByRole('button', { name: 'Закрыть чат' }));
        expect(reload).toHaveBeenCalledTimes(1);
        act(() => (visit.mock.calls.at(-1)?.[1] as { onFinish: () => void }).onFinish());

        expect(reload).toHaveBeenCalledTimes(2);
    });

    it('reload списка завершился до клика по панели: после перехода повтора нет', () => {
        view({
            active: { conversation: conversation({ id: 'c1' }), messages: [], has_more: false },
        });
        act(() => fake.emit('.unread.changed', { unread: 4 }));
        const options = reload.mock.calls[0]?.[0] as { onStart: () => void; onFinish: () => void };
        options.onStart();
        options.onFinish();

        fireEvent.click(screen.getByRole('button', { name: 'Закрыть чат' }));
        act(() => (visit.mock.calls.at(-1)?.[1] as { onFinish: () => void }).onFinish());

        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('два перехода подряд, событие во время первого: один reload после обоих', () => {
        view({
            active: { conversation: conversation({ id: 'c1' }), messages: [], has_more: false },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Закрыть чат' }));
        const first = visit.mock.calls.at(-1)?.[1] as { onFinish: () => void };
        act(() => fake.emit('.unread.changed', { unread: 4 }));

        fireEvent.click(screen.getByRole('button', { name: 'Закрыть чат' }));
        act(() => first.onFinish());
        expect(reload).not.toHaveBeenCalled();
        act(() => (visit.mock.calls.at(-1)?.[1] as { onFinish: () => void }).onFinish());

        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('переход панели без событий: лишнего обновления списка после него нет', () => {
        view({
            active: { conversation: conversation({ id: 'c1' }), messages: [], has_more: false },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Закрыть чат' }));
        act(() => (visit.mock.calls.at(-1)?.[1] as { onFinish: () => void }).onFinish());

        expect(reload).not.toHaveBeenCalled();
    });

    it('после «Закрыть чат» фокус возвращается на строку закрытой беседы', () => {
        const active = {
            conversation: conversation({ id: 'c1' }),
            messages: [],
            has_more: false,
        };
        const { rerender } = view({ active });

        fireEvent.click(screen.getByRole('button', { name: 'Закрыть чат' }));
        const next: Props = { conversations: LIST, active: null, compose: null };
        pageProps = { ...pageProps, ...next };
        rerender(<MessagesIndex {...next} />);

        const row = within(screen.getByRole('list', { name: 'Чаты' })).getAllByRole('link')[0];
        expect(document.activeElement).toBe(row);
    });

    it('если беседа закрылась не кнопкой «Закрыть чат», фокус не уводится на список', () => {
        const active = {
            conversation: conversation({ id: 'c1' }),
            messages: [],
            has_more: false,
        };
        const { rerender } = view({ active });
        const before = document.activeElement;

        const next: Props = { conversations: LIST, active: null, compose: null };
        pageProps = { ...pageProps, ...next };
        rerender(<MessagesIndex {...next} />);

        expect(document.activeElement).toBe(before);
    });

    it('черновик «Написать продавцу»: справа продавец и поле ввода; первое сообщение ведёт в созданную беседу', async () => {
        fetchMock.mockImplementation(async () =>
            json(
                {
                    conversation: conversation({ id: 'new-1' }),
                    message: message(1, 'Здравствуйте', true),
                },
                201,
            ),
        );
        view({
            conversations: [],
            compose: {
                listing: { id: 'l1', title: 'Fender ’57 Stratocaster', price: 184_500 },
                counterpart: { name: 'Олег' },
            },
        });

        expect(root()).toHaveAttribute('data-view', 'thread');
        const field = screen.getByRole('textbox', { name: 'Сообщение' });
        fireEvent.change(field, { target: { value: 'Здравствуйте' } });
        await act(async () => {
            fireEvent.keyDown(field, { key: 'Enter' });
        });

        expect(visit).toHaveBeenCalledWith(
            '/messages/new-1',
            expect.objectContaining({ replace: true, preserveState: false }),
        );
    });

    it('изменился счётчик непрочитанных (событие канала) — список обновляется с сервера', () => {
        view();

        act(() => fake.emit('.unread.changed', { unread: 4 }));

        expect(reload).toHaveBeenCalledWith(
            expect.objectContaining({ only: ['conversations', 'messages'] }),
        );
    });

    it('счётчик не менялся — лишних перезагрузок нет', () => {
        view();

        expect(reload).not.toHaveBeenCalled();
    });

    it('после отправки сообщения список обновляется (превью, порядок)', async () => {
        fetchMock.mockImplementation(async (url: string) =>
            String(url).endsWith('/read')
                ? json({ unread: 0 })
                : json({ data: message(5, 'Ответ', true) }, 201),
        );
        view({
            active: { conversation: conversation({ id: 'c1' }), messages: [], has_more: false },
        });

        const field = screen.getByRole('textbox', { name: 'Сообщение' });
        fireEvent.change(field, { target: { value: 'Ответ' } });
        await act(async () => {
            fireEvent.keyDown(field, { key: 'Enter' });
        });

        expect(reload).toHaveBeenCalledWith(
            expect.objectContaining({ only: ['conversations', 'messages'] }),
        );
    });

    it('при смене беседы переписка собирается заново: сообщения прежней не остаются', () => {
        const { rerender } = view({
            active: {
                conversation: conversation({ id: 'c1' }),
                messages: [message(1, 'Из первой беседы', false)],
                has_more: false,
            },
        });

        const next: Props = {
            conversations: LIST,
            compose: null,
            active: {
                conversation: conversation({ id: 'c2' }),
                messages: [message(2, 'Из второй беседы', false, { conversation_id: 'c2' })],
                has_more: false,
            },
        };
        pageProps = { ...pageProps, ...next };
        rerender(<MessagesIndex {...next} />);

        expect(screen.queryByText('Из первой беседы')).toBeNull();
        expect(screen.getByText('Из второй беседы')).toBeInTheDocument();
    });
});
