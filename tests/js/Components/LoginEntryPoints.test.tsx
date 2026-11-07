import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PublicLayout from '@/Layouts/PublicLayout';
import { closeLogin, getLoginRequest } from '@/Hooks/loginDialog';

let pageProps: Record<string, unknown> = {};

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    router: { visit: vi.fn(), post: vi.fn(), on: vi.fn() },
    usePage: () => ({ props: pageProps }),
}));

const CANCELLED = 'Вход через Яндекс ID отменён. Войдите по почте или попробуйте ещё раз';

beforeEach(() => {
    pageProps = { flags: {}, city: { id: 2, name: 'Москва' } };
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

describe('вход из каркаса страницы', () => {
    it('кнопка «Войти» в шапке открывает окно входа с адресом текущей страницы для возврата', () => {
        render(<PublicLayout />);
        const button = screen.getByRole('button', { name: 'Войти' });

        fireEvent.click(button);

        expect(screen.getByRole('dialog', { name: 'Вход' })).toBeInTheDocument();
        expect(getLoginRequest()?.returnTo).toBe('/baraholka?page=2');
    });

    it('после закрытия окна фокус возвращается на кнопку «Войти» в шапке', () => {
        render(<PublicLayout />);
        const button = screen.getByRole('button', { name: 'Войти' });
        button.focus();
        fireEvent.click(button);

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(button).toHaveFocus();
    });

    it('вкладка «Кабинет» нижней панели (< 640 px) открывает окно входа', () => {
        render(<PublicLayout />);

        fireEvent.click(screen.getByRole('link', { name: 'Кабинет' }));

        expect(screen.getByRole('dialog', { name: 'Вход' })).toBeInTheDocument();
    });

    it('итог Яндекс ID из shared prop `login`: окно открыто сразу, с текстом отмены', () => {
        pageProps = {
            ...pageProps,
            login: { status: 'yandex_cancelled', message: CANCELLED },
        };

        render(<PublicLayout />);

        expect(screen.getByRole('dialog', { name: 'Вход' })).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent(CANCELLED);
    });

    it('без итога Яндекса окно закрыто', () => {
        render(<PublicLayout />);

        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
