import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LoginDialogHost from '@/Components/LoginDialogHost';
import { closeLogin, getLoginRequest } from '@/Hooks/loginDialog';
import { useAuthUser, useRequireAuth } from '@/Hooks/useAuthUser';

let pageProps: Record<string, unknown> = {};

vi.mock('@inertiajs/react', () => ({
    router: { visit: vi.fn(), on: vi.fn() },
    usePage: () => ({ props: pageProps }),
}));

const ANNA = { id: 7, name: 'Анна', city: null, is_staff: false };

let run: (action: () => void, opener?: HTMLElement | null) => void = () => {};
let seen: unknown = undefined;

function Probe() {
    run = useRequireAuth();
    seen = useAuthUser();
    return null;
}

beforeEach(() => {
    pageProps = { auth: { user: null } };
    window.history.pushState({}, '', '/lot/7');
    delete document.documentElement.dataset.hydrated;
    delete (window as { __ymLoginPending?: boolean }).__ymLoginPending;
});

afterEach(() => {
    act(() => closeLogin());
    cleanup();
});

describe('useAuthUser', () => {
    it('читает auth.user из shared props; без prop — null', () => {
        pageProps = { auth: { user: ANNA } };
        render(<Probe />);
        expect(seen).toEqual(ANNA);
        cleanup();

        pageProps = {};
        render(<Probe />);
        expect(seen).toBeNull();
    });
});

describe('useRequireAuth: «Написать», «В избранное», «Продать» у гостя и вошедшего', () => {
    it('гость: действие не выполняется, открывается окно входа с колбэком и возвратом на страницу', () => {
        const action = vi.fn();
        render(<Probe />);
        const opener = document.createElement('button');

        act(() => run(action, opener));

        expect(action).not.toHaveBeenCalled();
        const request = getLoginRequest();
        expect(request?.returnTo).toBe('/lot/7');
        expect(request?.opener).toBe(opener);

        request?.onAuthenticated?.();
        expect(action).toHaveBeenCalledTimes(1);
    });

    it('вошедший: действие выполняется сразу, окно не открывается', () => {
        pageProps = { auth: { user: ANNA } };
        const action = vi.fn();
        render(<Probe />);

        act(() => run(action));

        expect(action).toHaveBeenCalledTimes(1);
        expect(getLoginRequest()).toBeNull();
    });
});

describe('гидратация и «Войти» до неё', () => {
    it('после монтирования каркаса html помечен data-hydrated="true" (признак для e2e)', () => {
        expect(document.documentElement.dataset.hydrated).toBeUndefined();

        render(<LoginDialogHost />);

        expect(document.documentElement.dataset.hydrated).toBe('true');
    });

    it('клик по «Войти» до гидратации сохранён: окно открывается, когда страница ожила', () => {
        (window as { __ymLoginPending?: boolean }).__ymLoginPending = true;

        render(<LoginDialogHost />);

        expect(screen.getByRole('dialog', { name: 'Вход' })).toBeInTheDocument();
        expect((window as { __ymLoginPending?: boolean }).__ymLoginPending).toBeUndefined();
    });

    it('без отложенного клика окно закрыто', () => {
        render(<LoginDialogHost />);

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('отложенный клик вошедшего не открывает окно', () => {
        pageProps = { auth: { user: ANNA } };
        (window as { __ymLoginPending?: boolean }).__ymLoginPending = true;

        render(<LoginDialogHost />);

        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
