import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AccountProfile from '@/Pages/Account/Profile';

// 1.1.3: вкладка «Профиль» — имя, город, почта (только просмотр), Яндекс ID, уведомления, удаление-заглушка.

const { patch, put } = vi.hoisted(() => ({ patch: vi.fn(), put: vi.fn() }));
let pageProps: Record<string, unknown> = {};

vi.mock('@inertiajs/react', () => ({
    router: { patch, put },
    usePage: () => ({ props: pageProps }),
    Head: () => null,
}));

const MOSCOW = { id: 1, name: 'Москва', type: 'г.' };

const PROFILE = {
    name: 'Анна',
    email: 'anna@example.test',
    city: MOSCOW,
    yandex_connected: true,
    since: '2026-03',
};

type Props = React.ComponentProps<typeof AccountProfile>;

function view(props: Partial<Props> = {}, errors: Record<string, string> = {}) {
    const merged: Props = {
        profile: PROFILE,
        notifications: [{ key: 'new_message', enabled: true }],
        ...props,
    };
    pageProps = { errors, ...merged };
    return render(<AccountProfile {...merged} />);
}

const cities = [
    { id: 1, name: 'Москва', region: 'Москва' },
    { id: 2, name: 'Казань', region: 'Татарстан' },
];

beforeEach(() => {
    patch.mockReset();
    put.mockReset();
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ data: cities }), { status: 200 })),
    );
});

describe('Account/Profile', () => {
    it('показывает имя, город с типом «г.», почту и подпись «на ЯМузыканте с …»', () => {
        view();

        expect(screen.getByLabelText('Имя')).toHaveValue('Анна');
        expect(screen.getByText('г. Москва')).toBeInTheDocument();
        expect(screen.getByText('На ЯМузыканте с марта 2026')).toBeInTheDocument();
    });

    it('почта — только просмотр: не редактируется, подсказка, что её видите только вы', () => {
        view();

        const email = screen.getByLabelText('Почта для входа');
        expect(email).toHaveValue('anna@example.test');
        expect(email).toHaveAttribute('readonly');
        expect(screen.getByText(/Видите только вы/)).toBeInTheDocument();
    });

    it('отметка «Яндекс ID подключён» — только когда он подключён', () => {
        const { unmount } = view();
        expect(screen.getByText('Яндекс ID подключён')).toBeInTheDocument();
        unmount();

        view({ profile: { ...PROFILE, yandex_connected: false } });
        expect(screen.queryByText('Яндекс ID подключён')).toBeNull();
    });

    it('«Сохранить» отправляет имя и город через PATCH, ошибки не теряются', () => {
        view();

        fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Анна Ким' } });
        fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

        expect(patch).toHaveBeenCalledTimes(1);
        const [url, data] = patch.mock.calls[0] as [string, Record<string, unknown>];
        expect(url).toBe('/account/profile');
        expect(data).toEqual({ name: 'Анна Ким', city_id: 1 });
    });

    it('после успешного сохранения — сообщение «Профиль сохранён» (role=status)', async () => {
        patch.mockImplementation(
            (_url: string, _data: unknown, options: { onSuccess?: () => void }) =>
                options.onSuccess?.(),
        );
        view();

        fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

        expect(await screen.findByRole('status')).toHaveTextContent('Профиль сохранён');
    });

    it('ошибка имени сервера показана у поля', () => {
        view({}, { name: 'Укажите имя' });

        expect(screen.getByLabelText('Имя')).toBeInvalid();
        expect(screen.getByText('Укажите имя')).toBeInTheDocument();
    });

    it('город меняется через справочник: «Изменить» открывает поиск, выбор подставляется и уходит в PATCH', async () => {
        view();

        fireEvent.click(screen.getByRole('button', { name: 'Изменить город' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Казань' }));

        expect(screen.getByText('г. Казань')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
        expect((patch.mock.calls[0] as [string, Record<string, unknown>])[1]).toEqual({
            name: 'Анна',
            city_id: 2,
        });
    });

    it('без города — «Не выбран» и city_id: null', () => {
        view({ profile: { ...PROFILE, city: null } });

        expect(screen.getByText('Не выбран')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
        expect((patch.mock.calls[0] as [string, Record<string, unknown>])[1]).toEqual({
            name: 'Анна',
            city_id: null,
        });
    });

    it('уведомления: флажок «Письма о новых сообщениях» сразу сохраняется через PUT', async () => {
        view();

        const box = screen.getByRole('checkbox', { name: /Письма о новых сообщениях/ });
        expect(box).toBeChecked();
        fireEvent.click(box);

        await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
        const [url, data] = put.mock.calls[0] as [string, Record<string, unknown>];
        expect(url).toBe('/account/notifications');
        expect(data).toEqual({ new_message: false });
    });

    it('сказано, что письма с кодом входа приходят всегда', () => {
        view();

        expect(screen.getByText(/Код для входа придёт в любом случае/)).toBeInTheDocument();
    });

    it('удаление аккаунта — заглушка: кнопка недоступна, подпись «Появится позже»', () => {
        view();

        const section = screen.getByRole('region', { name: 'Удаление аккаунта' });
        expect(within(section).getByRole('button', { name: 'Удалить аккаунт' })).toBeDisabled();
        expect(within(section).getByText(/Появится позже/)).toBeInTheDocument();
    });
});
