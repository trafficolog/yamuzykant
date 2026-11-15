import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FavoriteToggle from '@/Components/FavoriteToggle';

// 4.3.1: сердце «В избранное» — оптимистичное, с откатом при ошибке; гость сначала входит (1.1.2).

let pageProps: Record<string, unknown> = {};

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: pageProps }),
}));

const openLogin = vi.fn();
vi.mock('@/Hooks/loginDialog', () => ({ openLogin: (input: unknown) => openLogin(input) }));

const setFavorite = vi.fn();
vi.mock('@/lib/favoritesApi', () => ({
    setFavorite: (id: string, next: boolean) => setFavorite(id, next),
}));

const ANNA = { id: 7, name: 'Анна', city: null, is_staff: false };

const heart = (pressed: boolean) =>
    screen.getByRole('button', { name: pressed ? 'Убрать из избранного' : 'В избранное' });

/** Ответ сервера, который приходит, когда тест решит. */
function deferred() {
    let resolve: (status: number) => void = () => {};
    const promise = new Promise<number>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

beforeEach(() => {
    pageProps = { auth: { user: ANNA } };
    setFavorite.mockReset();
    openLogin.mockReset();
});

describe('FavoriteToggle', () => {
    it('показывает состояние из props', () => {
        render(<FavoriteToggle listingId="lot-1" favorite />);

        expect(heart(true)).toHaveAttribute('aria-pressed', 'true');
    });

    it('клик меняет сердце сразу, до ответа сервера, и отправляет PUT-состояние', async () => {
        const pending = deferred();
        setFavorite.mockReturnValue(pending.promise);
        render(<FavoriteToggle listingId="lot-1" favorite={false} />);

        fireEvent.click(heart(false));

        expect(heart(true)).toHaveAttribute('aria-pressed', 'true');
        expect(setFavorite).toHaveBeenCalledWith('lot-1', true);

        await act(async () => pending.resolve(200));
        expect(heart(true)).toBeInTheDocument();
    });

    it('повторный клик снимает отметку', async () => {
        setFavorite.mockResolvedValue(200);
        render(<FavoriteToggle listingId="lot-1" favorite />);

        await act(async () => {
            fireEvent.click(heart(true));
        });

        expect(setFavorite).toHaveBeenCalledWith('lot-1', false);
        expect(heart(false)).toBeInTheDocument();
    });

    it('ошибка сервера откатывает сердце и сообщает об этом', async () => {
        setFavorite.mockResolvedValue(500);
        render(<FavoriteToggle listingId="lot-1" favorite={false} />);

        await act(async () => {
            fireEvent.click(heart(false));
        });

        expect(heart(false)).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('status')).toHaveTextContent(
            'Не удалось обновить избранное. Попробуйте ещё раз',
        );
    });

    it('лимит (429) и обрыв сети тоже откатывают', async () => {
        setFavorite.mockResolvedValueOnce(429).mockRejectedValueOnce(new Error('offline'));
        render(<FavoriteToggle listingId="lot-1" favorite={false} />);

        await act(async () => {
            fireEvent.click(heart(false));
        });
        expect(heart(false)).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(heart(false));
        });
        expect(heart(false)).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Не удалось обновить избранное');
    });

    it('следующая успешная попытка убирает сообщение об ошибке', async () => {
        setFavorite.mockResolvedValueOnce(500).mockResolvedValueOnce(200);
        render(<FavoriteToggle listingId="lot-1" favorite={false} />);

        await act(async () => {
            fireEvent.click(heart(false));
        });
        await act(async () => {
            fireEvent.click(heart(false));
        });

        expect(heart(true)).toBeInTheDocument();
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    it('пока запрос в пути, повторные клики игнорируются', async () => {
        const pending = deferred();
        setFavorite.mockReturnValue(pending.promise);
        render(<FavoriteToggle listingId="lot-1" favorite={false} />);

        fireEvent.click(heart(false));
        fireEvent.click(heart(true));

        expect(setFavorite).toHaveBeenCalledTimes(1);
        await act(async () => pending.resolve(200));
    });

    it('гость: запроса нет, открывается окно входа; после входа добавление выполняется', async () => {
        pageProps = { auth: { user: null } };
        setFavorite.mockResolvedValue(200);
        render(<FavoriteToggle listingId="lot-1" favorite={false} />);

        fireEvent.click(heart(false));

        expect(setFavorite).not.toHaveBeenCalled();
        expect(heart(false)).toBeInTheDocument();
        const request = openLogin.mock.calls[0]?.[0] as { onAuthenticated?: () => void };
        expect(request.onAuthenticated).toBeTypeOf('function');

        await act(async () => request.onAuthenticated?.());

        expect(setFavorite).toHaveBeenCalledWith('lot-1', true);
        expect(heart(true)).toBeInTheDocument();
    });

    it('сессия истекла (401): сердце откатывается, окно входа повторит действие', async () => {
        setFavorite.mockResolvedValueOnce(401).mockResolvedValueOnce(200);
        render(<FavoriteToggle listingId="lot-1" favorite={false} />);

        await act(async () => {
            fireEvent.click(heart(false));
        });

        expect(heart(false)).toBeInTheDocument();
        const request = openLogin.mock.calls[0]?.[0] as { onAuthenticated?: () => void };
        await act(async () => request.onAuthenticated?.());

        expect(setFavorite).toHaveBeenLastCalledWith('lot-1', true);
        expect(heart(true)).toBeInTheDocument();
    });

    it('новое значение из props (после входа страница обновилась) переключает сердце', () => {
        const { rerender } = render(<FavoriteToggle listingId="lot-1" favorite={false} />);

        rerender(<FavoriteToggle listingId="lot-1" favorite />);

        expect(heart(true)).toBeInTheDocument();
    });
});
