import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MobileTabBar from '@/Components/MobileTabBar';
import SiteHeader from '@/Components/SiteHeader';
import { closeLogin, getLoginRequest } from '@/Hooks/loginDialog';
import PublicLayout from '@/Layouts/PublicLayout';

const { postJson, hardNavigate } = vi.hoisted(() => ({ postJson: vi.fn(), hardNavigate: vi.fn() }));

vi.mock('@/lib/postJson', () => ({ postJson }));
vi.mock('@/lib/navigate', () => ({ hardNavigate }));

let pageProps: Record<string, unknown> = {};

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    router: { visit: vi.fn(), post: vi.fn(), on: vi.fn() },
    usePage: () => ({ props: pageProps }),
}));

const ANNA = { id: 7, name: 'Анна', city: { id: 2, name: 'Москва' }, is_staff: false };

beforeEach(() => {
    pageProps = { flags: {}, city: { id: 2, name: 'Москва' }, auth: { user: null } };
    postJson.mockReset();
    hardNavigate.mockReset();
    window.history.pushState({}, '', '/baraholka?page=2');
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

afterEach(() => {
    act(() => closeLogin());
    cleanup();
});

const accountButton = () => screen.getByRole('button', { name: /Анна/ });

describe('шапка: гость', () => {
    it('вместо меню кабинета — кнопка «Войти»', () => {
        render(<SiteHeader user={null} />);

        expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Анна/ })).toBeNull();
    });
});

describe('шапка: вошедший', () => {
    it('вместо «Войти» — кнопка кабинета с именем; меню закрыто', () => {
        render(<SiteHeader user={ANNA} />);

        expect(screen.queryByRole('button', { name: 'Войти' })).toBeNull();
        expect(accountButton()).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('group', { name: 'Кабинет' })).toBeNull();
    });

    it('меню: «Покупаю» и «Продаю», «Сообщения», «Избранное», «Профиль», «Выйти»', () => {
        render(<SiteHeader user={ANNA} />);

        fireEvent.click(accountButton());

        expect(accountButton()).toHaveAttribute('aria-expanded', 'true');
        const menu = screen.getByRole('group', { name: 'Кабинет' });
        expect(within(menu).getByText('Покупаю')).toBeInTheDocument();
        expect(within(menu).getByText('Продаю')).toBeInTheDocument();
        expect(within(menu).getByRole('link', { name: 'Избранное' })).toBeInTheDocument();
        expect(within(menu).getByRole('link', { name: 'Объявления' })).toBeInTheDocument();
        expect(within(menu).getByRole('link', { name: 'Сообщения' })).toHaveAttribute(
            'href',
            '/messages',
        );
        expect(within(menu).getByRole('link', { name: 'Профиль' })).toHaveAttribute(
            'href',
            '/account/profile',
        );
        expect(within(menu).getByRole('button', { name: 'Выйти' })).toBeInTheDocument();
    });

    it('в меню нет почты и слов вне словаря', () => {
        render(<SiteHeader user={ANNA} />);
        fireEvent.click(accountButton());

        expect(document.body.textContent).not.toMatch(/@|гир/i);
    });

    it('Esc закрывает меню и возвращает фокус на кнопку', () => {
        render(<SiteHeader user={ANNA} />);
        fireEvent.click(accountButton());

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(screen.queryByRole('group', { name: 'Кабинет' })).toBeNull();
        expect(accountButton()).toHaveFocus();
    });

    it('клик вне меню закрывает его', () => {
        render(<SiteHeader user={ANNA} />);
        fireEvent.click(accountButton());

        fireEvent.pointerDown(document.body);

        expect(screen.queryByRole('group', { name: 'Кабинет' })).toBeNull();
    });

    it('«Выйти»: POST /auth/logout, затем переход на главную', async () => {
        postJson.mockResolvedValue({ status: 200, body: { status: 'logged_out', redirect: '/' } });
        render(<SiteHeader user={ANNA} />);
        fireEvent.click(accountButton());

        fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));

        await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith('/'));
        expect(postJson).toHaveBeenCalledWith('/auth/logout', {});
    });

    it.each([401, 419])('ответ %i: сессии уже нет, переход на главную', async (status) => {
        postJson.mockResolvedValue({ status, body: {} });
        render(<SiteHeader user={ANNA} />);
        fireEvent.click(accountButton());

        fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));

        await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith('/'));
    });

    it('сбой выхода: переход не выполняется, текст ошибки, кнопка снова доступна', async () => {
        postJson.mockResolvedValue({ status: 500, body: {} });
        render(<SiteHeader user={ANNA} />);
        fireEvent.click(accountButton());

        fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Не удалось выйти. Попробуйте ещё раз',
        );
        expect(hardNavigate).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Выйти' })).toBeEnabled();
    });

    it('нет ответа сети: та же ошибка, без перехода', async () => {
        postJson.mockRejectedValue(new TypeError('network'));
        render(<SiteHeader user={ANNA} />);
        fireEvent.click(accountButton());

        fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));

        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(hardNavigate).not.toHaveBeenCalled();
    });

    it('повторное нажатие во время выхода не отправляет второй запрос', async () => {
        let resolve: (value: unknown) => void = () => {};
        postJson.mockReturnValue(new Promise((done) => (resolve = done)));
        render(<SiteHeader user={ANNA} />);
        fireEvent.click(accountButton());
        const logout = screen.getByRole('button', { name: 'Выйти' });

        fireEvent.click(logout);
        fireEvent.click(logout);
        await act(async () => resolve({ status: 200, body: {} }));

        expect(postJson).toHaveBeenCalledTimes(1);
    });
});

describe('«Продать инструмент»', () => {
    it('гость: открывает окно входа с возвратом на текущую страницу и колбэком', () => {
        render(<SiteHeader user={null} />);

        fireEvent.click(screen.getByRole('link', { name: 'Продать инструмент' }));

        expect(screen.queryByRole('dialog')).toBeNull(); // окно рисует LoginDialogHost каркаса
        expect(getLoginRequest()?.returnTo).toBe('/baraholka?page=2');
        expect(getLoginRequest()?.onAuthenticated).toBeTypeOf('function');
    });

    it('вошедший: окно входа не открывается, ссылка работает как обычно', () => {
        render(<SiteHeader user={ANNA} />);

        fireEvent.click(screen.getByRole('link', { name: 'Продать инструмент' }));

        expect(getLoginRequest()).toBeNull();
    });
});

describe('нижняя панель', () => {
    const bar = () => screen.getByRole('navigation', { name: 'Нижнее меню' });

    it('гость: «Кабинет» открывает окно входа', () => {
        render(<MobileTabBar user={null} />);

        fireEvent.click(within(bar()).getByRole('button', { name: 'Кабинет' }));

        expect(getLoginRequest()).not.toBeNull();
    });

    it('вошедший: «Кабинет» открывает то же меню кабинета, а не окно входа', () => {
        render(<MobileTabBar user={ANNA} />);
        const tab = within(bar()).getByRole('button', { name: 'Кабинет' });

        fireEvent.click(tab);

        expect(getLoginRequest()).toBeNull();
        expect(tab).toHaveAttribute('aria-expanded', 'true');
        const menu = screen.getByRole('group', { name: 'Кабинет' });
        expect(within(menu).getByRole('link', { name: 'Избранное' })).toBeInTheDocument();
        expect(within(menu).getByRole('button', { name: 'Выйти' })).toBeInTheDocument();
    });

    it('вошедший: «Выйти» из нижней панели выходит так же', async () => {
        postJson.mockResolvedValue({ status: 200, body: {} });
        render(<MobileTabBar user={ANNA} />);
        fireEvent.click(within(bar()).getByRole('button', { name: 'Кабинет' }));

        fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));

        await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith('/'));
        expect(postJson).toHaveBeenCalledWith('/auth/logout', {});
    });

    it('Esc закрывает меню и возвращает фокус на вкладку', () => {
        render(<MobileTabBar user={ANNA} />);
        const tab = within(bar()).getByRole('button', { name: 'Кабинет' });
        fireEvent.click(tab);

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(screen.queryByRole('group', { name: 'Кабинет' })).toBeNull();
        expect(tab).toHaveFocus();
    });
});

describe('каркас страницы: shared prop auth.user', () => {
    it('гость: «Войти» в шапке', () => {
        render(<PublicLayout />);

        expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    });

    it('вошедший: меню кабинета вместо «Войти», окно входа не открывается', () => {
        pageProps = { ...pageProps, auth: { user: ANNA } };

        render(<PublicLayout />);

        expect(screen.queryByRole('button', { name: 'Войти' })).toBeNull();
        expect(screen.getByRole('banner')).toContainElement(accountButton());
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('без prop auth (ответ без пользователя) каркас показывает гостя', () => {
        pageProps = { flags: {}, city: null };

        render(<PublicLayout />);

        expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    });
});

describe('меню кабинета — раскрывающийся список, а не popup-меню (ARIA disclosure)', () => {
    it('кнопка в шапке: aria-expanded и aria-controls есть, aria-haspopup нет', () => {
        render(<SiteHeader user={ANNA} />);
        const button = accountButton();
        expect(button).not.toHaveAttribute('aria-haspopup');
        expect(button).not.toHaveAttribute('aria-controls');

        fireEvent.click(button);

        expect(button).not.toHaveAttribute('aria-haspopup');
        expect(button).toHaveAttribute('aria-expanded', 'true');
        const panel = screen.getByRole('group', { name: 'Кабинет' });
        expect(button).toHaveAttribute('aria-controls', panel.id);
    });

    it('вкладка «Кабинет» вошедшего — кнопка: aria-expanded и aria-controls, без aria-haspopup', () => {
        render(<MobileTabBar user={ANNA} />);
        const tab = within(screen.getByRole('navigation', { name: 'Нижнее меню' })).getByRole(
            'button',
            { name: 'Кабинет' },
        );
        expect(tab.tagName).toBe('BUTTON');
        expect(tab).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(tab);

        expect(tab).not.toHaveAttribute('aria-haspopup');
        expect(tab).toHaveAttribute('aria-expanded', 'true');
        expect(tab).toHaveAttribute(
            'aria-controls',
            screen.getByRole('group', { name: 'Кабинет' }).id,
        );
    });

    it('вкладка «Кабинет» гостя — тоже кнопка; она открывает диалог входа, поэтому aria-haspopup="dialog"', () => {
        render(<MobileTabBar user={null} />);
        const tab = within(screen.getByRole('navigation', { name: 'Нижнее меню' })).getByRole(
            'button',
            { name: 'Кабинет' },
        );

        expect(tab.tagName).toBe('BUTTON');
        expect(tab).toHaveAttribute('aria-haspopup', 'dialog');
        expect(tab).not.toHaveAttribute('aria-expanded');
    });
});
