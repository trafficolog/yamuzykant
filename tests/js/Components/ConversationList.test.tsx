import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ConversationList from '@/Components/ConversationList';
import { listItem } from '../support/messages';

// 4.1.2: ConversationList — поиск, фильтр «Все / Покупаю / Продаю», архив, непрочитанные, пустые состояния.

const onOpen = vi.fn();

type Props = ComponentProps<typeof ConversationList>;

const ITEMS: Props['conversations'] = [
    listItem('buy-1', {
        counterpart: { name: 'Андрей К.', deleted: false },
        listing: {
            id: 'l1',
            title: 'Fender American Vintage ’57 Stratocaster',
            price: 184_500,
            available: true,
        },
        unread: 2,
        last_message: {
            body: 'Здравствуйте. Шлифовали в «Лад и строй»',
            mine: false,
            kind: 'text',
            created_at: '2026-09-09T06:28:00Z',
        },
    }),
    listItem('sell-1', {
        role: 'selling',
        counterpart: { name: 'Ирина С.', deleted: false },
        listing: { id: 'l2', title: 'Gibson Les Paul Studio', price: 120_000, available: true },
        last_message: {
            body: 'Беру',
            mine: true,
            kind: 'text',
            created_at: '2026-09-08T10:00:00Z',
        },
    }),
    listItem('old-1', {
        counterpart: { name: 'Гитарный угол', deleted: false },
        listing: { id: 'l3', title: 'Fender Player Telecaster', price: 87_990, available: false },
        closed: true,
    }),
];

function view(props: Partial<Props> = {}) {
    return render(
        <ConversationList conversations={ITEMS} activeId={null} onOpen={onOpen} {...props} />,
    );
}

const chip = (name: string) => screen.getByRole('radio', { name: new RegExp(`^${name}`) });
const rows = () => within(screen.getByRole('list', { name: 'Чаты' })).getAllByRole('listitem');

beforeEach(() => {
    onOpen.mockReset();
});

describe('ConversationList', () => {
    it('заголовок «Сообщения» и строки: собеседник, объявление, последнее сообщение', () => {
        view();

        expect(screen.getByRole('heading', { name: 'Сообщения' })).toBeInTheDocument();
        // Архивная беседа («old-1») по умолчанию скрыта: «Все» — активные чаты.
        expect(rows()).toHaveLength(2);
        const first = rows()[0] as HTMLElement;
        expect(first).toHaveTextContent('Андрей К.');
        expect(first).toHaveTextContent('Fender American Vintage ’57 Stratocaster');
        expect(first).toHaveTextContent('Здравствуйте. Шлифовали в «Лад и строй»');
    });

    it('своё последнее сообщение — с пометкой «Вы:»', () => {
        view();

        expect(rows()[1]).toHaveTextContent('Вы: Беру');
    });

    it('непрочитанные: значок с числом и доступным названием, у прочитанных значка нет', () => {
        view();

        expect(
            within(rows()[0] as HTMLElement).getByLabelText('2 непрочитанных'),
        ).toHaveTextContent('2');
        expect(within(rows()[1] as HTMLElement).queryByLabelText(/непрочитанн/)).toBeNull();
    });

    it('склонение: 1 непрочитанное, 5 непрочитанных', () => {
        view({ conversations: [listItem('a', { unread: 1 }), listItem('b', { unread: 5 })] });

        expect(screen.getByLabelText('1 непрочитанное')).toBeInTheDocument();
        expect(screen.getByLabelText('5 непрочитанных')).toBeInTheDocument();
    });

    it('строка — ссылка на беседу; текущая помечена aria-current', () => {
        view({ activeId: 'sell-1' });

        const links = screen.getAllByRole('link');
        expect(links.map((a) => a.getAttribute('href'))).toEqual([
            '/messages/buy-1',
            '/messages/sell-1',
        ]);
        expect(links[1]).toHaveAttribute('aria-current', 'true');
        expect(links[0]).not.toHaveAttribute('aria-current');
    });

    it('обычный клик открывает беседу без перезагрузки, клик с Ctrl не перехватывается', () => {
        view();

        const link = screen.getAllByRole('link')[0] as HTMLElement;
        expect(fireEvent.click(link)).toBe(false);
        expect(onOpen).toHaveBeenCalledWith('buy-1');

        onOpen.mockReset();
        expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
        expect(onOpen).not.toHaveBeenCalled();
    });

    it('фильтр «Покупаю / Продаю» с количеством в чипах', () => {
        view();

        expect(chip('Все')).toHaveTextContent('2');
        expect(chip('Покупаю')).toHaveTextContent('1');
        expect(chip('Продаю')).toHaveTextContent('1');
        expect(chip('Все')).toHaveAttribute('aria-checked', 'true');

        fireEvent.click(chip('Продаю'));
        expect(rows()).toHaveLength(1);
        expect(rows()[0]).toHaveTextContent('Ирина С.');
        expect(chip('Продаю')).toHaveAttribute('aria-checked', 'true');

        fireEvent.click(chip('Покупаю'));
        expect(rows()).toHaveLength(1);
        expect(rows()[0]).toHaveTextContent('Андрей К.');
    });

    it('архив: закрытые для ответов беседы только там, обычные списки их не показывают', () => {
        view();

        expect(chip('Архив')).toHaveTextContent('1');
        fireEvent.click(chip('Архив'));

        expect(rows()).toHaveLength(1);
        expect(rows()[0]).toHaveTextContent('Гитарный угол');
        expect(rows()[0]).toHaveTextContent('Только чтение');
    });

    it('поиск по собеседнику, названию объявления и тексту; сброс возвращает список', () => {
        view();

        fireEvent.click(screen.getByRole('button', { name: 'Поиск по чатам' }));
        const search = screen.getByRole('searchbox', { name: 'Поиск по чатам' });

        fireEvent.change(search, { target: { value: 'ирина' } });
        expect(rows()).toHaveLength(1);
        expect(rows()[0]).toHaveTextContent('Ирина С.');

        fireEvent.change(search, { target: { value: 'stratocaster' } });
        expect(rows()[0]).toHaveTextContent('Андрей К.');

        fireEvent.change(search, { target: { value: 'шлифовали' } });
        expect(rows()[0]).toHaveTextContent('Андрей К.');

        fireEvent.change(search, { target: { value: '' } });
        expect(rows()).toHaveLength(2);
    });

    it('поиск ничего не нашёл — сказано об этом; поиск идёт по всем чатам, включая архив', () => {
        view();
        fireEvent.click(screen.getByRole('button', { name: 'Поиск по чатам' }));
        const search = screen.getByRole('searchbox', { name: 'Поиск по чатам' });

        fireEvent.change(search, { target: { value: 'telecaster' } });
        expect(rows()).toHaveLength(1);

        fireEvent.change(search, { target: { value: 'нет такого' } });
        expect(screen.getByText('Ничего не найдено.')).toBeInTheDocument();
    });

    it('Escape в поиске закрывает его и возвращает фокус на кнопку', () => {
        view();
        fireEvent.click(screen.getByRole('button', { name: 'Поиск по чатам' }));
        const search = screen.getByRole('searchbox', { name: 'Поиск по чатам' });
        fireEvent.change(search, { target: { value: 'ирина' } });

        fireEvent.keyDown(search, { key: 'Escape' });

        expect(screen.queryByRole('searchbox')).toBeNull();
        expect(rows()).toHaveLength(2);
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Поиск по чатам' }));
    });

    it('чатов нет совсем: «Здесь пока нет чатов» с подсказкой, откуда начать', () => {
        view({ conversations: [] });

        expect(screen.getByText('Здесь пока нет чатов.')).toBeInTheDocument();
        expect(screen.getByText(/нажмите «Написать»/)).toBeInTheDocument();
        expect(screen.queryByRole('list', { name: 'Чаты' })).toBeNull();
    });

    it('в выбранном разделе чатов нет — подсказка раздела', () => {
        view({ conversations: [ITEMS[0] as Props['conversations'][number]] });

        fireEvent.click(chip('Продаю'));
        expect(screen.getByText('В этом разделе чатов нет.')).toBeInTheDocument();
    });

    it('удалившийся собеседник: имя из сервера, без значка проверки', () => {
        view({
            conversations: [
                listItem('x', {
                    counterpart: { name: 'Пользователь удалил аккаунт', deleted: true },
                }),
            ],
        });

        expect(rows()[0]).toHaveTextContent('Пользователь удалил аккаунт');
    });

    it('текст сообщения в превью — текст, а не разметка', () => {
        const { container } = view({
            conversations: [
                listItem('x', {
                    last_message: {
                        body: '<img src=x onerror=alert(1)>',
                        mine: false,
                        kind: 'text',
                        created_at: '2026-09-09T06:28:00Z',
                    },
                }),
            ],
        });

        expect(rows()[0]).toHaveTextContent('<img src=x onerror=alert(1)>');
        expect(container.querySelector('img')).toBeNull();
    });

    it('роль собеседника подписана доступно: «Продавец» / «Покупатель»', () => {
        view();

        expect(within(rows()[0] as HTMLElement).getByTitle('Продавец')).toBeInTheDocument();
        expect(within(rows()[1] as HTMLElement).getByTitle('Покупатель')).toBeInTheDocument();
    });
});
