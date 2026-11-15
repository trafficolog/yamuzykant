import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MyListing } from '@/lib/myListings';
import AccountListings from '@/Pages/Account/Listings';

// UC-L3, UC-L4 (2.1.5): вкладка «Объявления» — фильтр, статусы, действия, окна «Снизить цену» и «Снять с продажи».

const NBSP = ' ';
const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
let shared: Record<string, unknown> = {};

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: shared }),
    Head: () => null,
    router: {
        get: (...args: unknown[]) => get(...args),
        post: (...args: unknown[]) => post(...args),
        patch: (...args: unknown[]) => patch(...args),
    },
}));

function listing(overrides: Partial<MyListing> = {}): MyListing {
    return {
        id: 'l-1',
        title: 'Fender American Vintage ’57 Stratocaster',
        price: 184_500,
        negotiable: true,
        status: 'published',
        cover: null,
        return_reason: null,
        chats: 4,
        views: 2600,
        url: '/listings/l-1',
        ...overrides,
    };
}

const counts = { all: 3, published: 1, review: 1, closed: 1 };

const view = (listings: MyListing[], filter: 'all' | 'published' | 'review' | 'closed' = 'all') =>
    render(<AccountListings listings={listings} filter={filter} counts={counts} />);

beforeEach(() => {
    get.mockReset();
    post.mockReset();
    patch.mockReset();
    shared = { errors: {} };
});

describe('Account/Listings', () => {
    it('карточка: статус, цена по BR-11, просмотры и беседы', () => {
        view([listing(), listing({ id: 'l-2', price: null }), listing({ id: 'l-3', price: 0 })]);

        expect(screen.getAllByText('Опубликовано')).toHaveLength(3);
        expect(screen.getByText(`184${NBSP}500${NBSP}₽`)).toBeInTheDocument();
        expect(screen.getByText('Договорная')).toBeInTheDocument();
        expect(screen.getByText('Бесплатно')).toBeInTheDocument();
        expect(screen.queryByText(/^0/)).toBeNull();
        expect(screen.getAllByText(`Просмотры: 2${NBSP}600`)).toHaveLength(3);
        expect(screen.getAllByText('Чаты: 4')).toHaveLength(3);
    });

    it('фильтр по статусам: чипы с количеством, выбор запрашивает список с ?status=', () => {
        view([listing()]);

        const group = screen.getByRole('radiogroup', { name: 'Статус объявлений' });
        expect(within(group).getByRole('radio', { name: /Все/ })).toBeChecked();
        fireEvent.click(within(group).getByRole('radio', { name: /На проверке/ }));

        expect(get).toHaveBeenCalledWith(
            '/account/listings',
            { status: 'review' },
            expect.objectContaining({ replace: true }),
        );
    });

    it('опубликованное: изменить (форма продажи), снизить цену, снять', () => {
        view([listing()]);

        expect(screen.getByRole('link', { name: 'Изменить' })).toHaveAttribute(
            'href',
            '/listings/l-1/edit',
        );
        expect(screen.getByRole('button', { name: 'Снизить цену' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Снять с продажи' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Вернуть в продажу' })).toBeNull();
    });

    it('«Договорная» и «Бесплатно»: снижать нечего', () => {
        view([listing({ price: null }), listing({ id: 'l-2', price: 0 })]);

        expect(screen.queryByRole('button', { name: 'Снизить цену' })).toBeNull();
    });

    it('возвращённое на доработку показывает причину модератора дословно, изменить нельзя', () => {
        view([
            listing({
                status: 'needs_changes',
                return_reason: 'Добавьте фото грифа крупным планом.',
            }),
        ]);

        expect(screen.getByText('Нужны правки')).toBeInTheDocument();
        expect(screen.getByText(/Причина возврата/)).toBeInTheDocument();
        expect(screen.getByText(/Добавьте фото грифа крупным планом\./)).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Изменить' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Снять с продажи' })).toBeInTheDocument();
    });

    it('снятое — «Вернуть в продажу», истёкшее — «Продлить»; отклонённое — без действий', () => {
        view([
            listing({ status: 'withdrawn' }),
            listing({ id: 'l-2', status: 'expired' }),
            listing({ id: 'l-3', status: 'rejected', return_reason: 'Нарушение правил.' }),
        ]);

        fireEvent.click(screen.getByRole('button', { name: 'Вернуть в продажу' }));
        expect(post).toHaveBeenCalledWith('/listings/l-1/relist', {}, expect.any(Object));

        fireEvent.click(screen.getByRole('button', { name: 'Продлить' }));
        expect(post).toHaveBeenCalledWith('/listings/l-2/renew', {}, expect.any(Object));

        expect(screen.getByText(/Причина отклонения/)).toBeInTheDocument();
    });

    it('лимит активных объявлений при возврате показывается над списком', () => {
        view([listing({ status: 'withdrawn' })]);
        fireEvent.click(screen.getByRole('button', { name: 'Вернуть в продажу' }));

        const options = post.mock.calls[0]?.[2] as { onError: (e: Record<string, string>) => void };
        act(() => options.onError({ limit: 'Достигнут лимит: 10 активных объявлений.' }));

        expect(screen.getByRole('alert')).toHaveTextContent('Достигнут лимит');
    });

    it('пусто: сообщение; пусто по фильтру — другое', () => {
        const { unmount } = view([]);
        expect(screen.getByText(/У вас пока нет объявлений/)).toBeInTheDocument();
        unmount();

        view([], 'closed');
        expect(screen.getByText('Нет объявлений с таким статусом.')).toBeInTheDocument();
    });
});

describe('окно «Снизить цену»', () => {
    const open = () => {
        view([listing()]);
        fireEvent.click(screen.getByRole('button', { name: 'Снизить цену' }));
    };

    it('показывает текущую цену; кнопка неактивна, пока цена не ниже текущей', () => {
        open();

        const dialog = screen.getByRole('dialog', { name: 'Снизить цену' });
        expect(within(dialog).getByText(`Сейчас: 184${NBSP}500${NBSP}₽`)).toBeInTheDocument();

        const submit = within(dialog).getByRole('button', { name: 'Снизить цену' });
        expect(submit).toBeDisabled();
        fireEvent.change(within(dialog).getByRole('textbox', { name: 'Новая цена' }), {
            target: { value: '200000' },
        });
        expect(submit).toBeDisabled();
        expect(within(dialog).getByText('Укажите новую цену ниже текущей.')).toBeInTheDocument();
    });

    it('отправляет новую цену целыми рублями', () => {
        open();
        const dialog = screen.getByRole('dialog', { name: 'Снизить цену' });

        fireEvent.change(within(dialog).getByRole('textbox', { name: 'Новая цена' }), {
            target: { value: '170000' },
        });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Снизить цену' }));

        expect(patch).toHaveBeenCalledWith(
            '/listings/l-1/price',
            { price: 170_000 },
            expect.any(Object),
        );
    });
});

describe('окно «Снять с продажи»', () => {
    const open = (item: MyListing = listing()) => {
        view([item]);
        fireEvent.click(screen.getByRole('button', { name: 'Снять с продажи' }));
        return screen.getByRole('dialog', { name: 'Снять с продажи' });
    };

    it('причина обязательна: без выбора кнопка неактивна', () => {
        const dialog = open();

        expect(within(dialog).getByRole('button', { name: 'Снять с продажи' })).toBeDisabled();
        expect(within(dialog).getAllByRole('radio')).toHaveLength(3);
    });

    it('«Продал на ЯМузыканте»: поле «За сколько продали», сумма уходит с причиной', () => {
        const dialog = open();

        fireEvent.click(within(dialog).getByRole('radio', { name: 'Продал на ЯМузыканте' }));
        fireEvent.change(within(dialog).getByRole('textbox', { name: /За сколько продали/ }), {
            target: { value: '170000' },
        });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Снять с продажи' }));

        expect(post).toHaveBeenCalledWith(
            '/listings/l-1/withdraw',
            { reason: 'sold_here', final_price: 170_000 },
            expect.any(Object),
        );
    });

    it('«Передумал»: поля суммы нет, уходит одна причина', () => {
        const dialog = open();

        fireEvent.click(within(dialog).getByRole('radio', { name: 'Передумал' }));
        expect(within(dialog).queryByRole('textbox')).toBeNull();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Снять с продажи' }));

        expect(post).toHaveBeenCalledWith(
            '/listings/l-1/withdraw',
            { reason: 'changed_mind' },
            expect.any(Object),
        );
    });

    it('объявление на проверке: «Продал на ЯМузыканте» не предлагается', () => {
        const dialog = open(listing({ status: 'pending' }));

        expect(within(dialog).queryByRole('radio', { name: 'Продал на ЯМузыканте' })).toBeNull();
        expect(
            within(dialog).getByRole('radio', { name: 'Продал в другом месте' }),
        ).toBeInTheDocument();
    });
});
