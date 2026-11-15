import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CitySelect from '@/Components/CitySelect';
import { closeLogin, openLogin, useLoginRequest } from '@/Hooks/loginDialog';
import { ru } from '@/lang/ru';

type InvalidEvent = { detail: { response: { status: number } }; preventDefault: () => void };
const { post, listeners } = vi.hoisted(() => ({
    post: vi.fn(),
    listeners: {} as { invalid?: (event: InvalidEvent) => void },
}));

vi.mock('@inertiajs/react', () => ({
    router: {
        post,
        on: (_name: 'invalid', listener: (event: InvalidEvent) => void) => {
            listeners.invalid = listener;
            return () => {
                delete listeners.invalid;
            };
        },
    },
    usePage: () => ({ props: { flags: {} } }),
}));

const CITIES = [
    { id: 1, name: 'Волгоград', region: 'Волгоградская область' },
    { id: 2, name: 'Москва', region: 'Москва' },
    { id: 3, name: 'Санкт-Петербург', region: 'Санкт-Петербург' },
];

const moscow = { id: 2, name: 'Москва' };

const fetchMock = vi.fn();

function respondWith(data: unknown[]) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data }) } as Response);
}

const trigger = () => screen.getByRole('button', { name: 'Москва' });
const panel = () => screen.queryByRole('dialog', { name: ru.city.label });
const panelOrFail = (): HTMLElement => {
    const element = panel();
    if (!element) throw new Error('Панель выбора города не открыта');
    return element;
};
const open = async () => {
    fireEvent.click(trigger());
    await waitFor(() =>
        expect(panelOrFail().querySelectorAll('.ym-city__item').length).toBeGreaterThan(0),
    );
};

beforeEach(() => {
    post.mockReset();
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => respondWith(CITIES));
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    closeLogin();
    vi.unstubAllGlobals();
});

describe('CitySelect: кнопка', () => {
    it('показывает город кнопкой с иконкой; панель закрыта', () => {
        render(<CitySelect city={moscow} />);

        expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
        expect(trigger()).toHaveAttribute('aria-expanded', 'false');
        expect(panel()).toBeNull();
    });

    it('без города — «Москва» по умолчанию', () => {
        render(<CitySelect city={null} />);

        expect(trigger()).toBeInTheDocument();
    });

    it('клик открывает панель выбора города, поле поиска в фокусе, список загружен', async () => {
        render(<CitySelect city={moscow} />);

        fireEvent.click(trigger());

        expect(trigger()).toHaveAttribute('aria-expanded', 'true');
        expect(panel()).toBeInTheDocument();
        expect(screen.getByRole('searchbox', { name: ru.city.search })).toHaveFocus();
        await waitFor(() =>
            expect(
                within(panelOrFail()).getByRole('button', { name: 'Санкт-Петербург' }),
            ).toBeVisible(),
        );
        expect(fetchMock).toHaveBeenCalledWith(
            '/cities',
            expect.objectContaining({
                headers: expect.objectContaining({ Accept: 'application/json' }),
            }),
        );
    });
});

describe('CitySelect: список и поиск', () => {
    it('текущий город помечен aria-current, остальные нет', async () => {
        render(<CitySelect city={moscow} />);
        await open();

        const current = within(panelOrFail())
            .getAllByRole('button')
            .filter((item) => item.getAttribute('aria-current') === 'true');
        expect(current.map((item) => item.textContent)).toEqual(['Москва']);
    });

    it('ввод в поиск запрашивает справочник с параметром q', async () => {
        render(<CitySelect city={moscow} />);
        await open();

        fireEvent.change(screen.getByRole('searchbox', { name: ru.city.search }), {
            target: { value: 'Санкт' },
        });

        await waitFor(() =>
            expect(fetchMock).toHaveBeenLastCalledWith(
                expect.stringMatching(/^\/cities\?q=%D0%A1/),
                expect.anything(),
            ),
        );
    });

    it('пустой результат — сообщение, без списка', async () => {
        fetchMock.mockImplementation(() => respondWith([]));
        render(<CitySelect city={moscow} />);
        fireEvent.click(trigger());

        expect(await screen.findByText(ru.city.empty)).toBeInTheDocument();
        expect(panelOrFail().querySelectorAll('.ym-city__item')).toHaveLength(0);
    });

    it('ошибка загрузки справочника — сообщение с повтором действия', async () => {
        fetchMock.mockImplementation(() => Promise.reject(new Error('network')));
        render(<CitySelect city={moscow} />);
        await open().catch(() => undefined);

        expect(await screen.findByText(ru.city.loadError)).toBeInTheDocument();
    });
});

describe('CitySelect: выбор города', () => {
    it('выбор отправляет POST /city с city_id через Inertia, без перехода по ссылке', async () => {
        render(<CitySelect city={moscow} />);
        await open();

        fireEvent.click(within(panelOrFail()).getByRole('button', { name: 'Санкт-Петербург' }));

        expect(post).toHaveBeenCalledWith(
            '/city',
            { city_id: 3 },
            expect.objectContaining({ preserveScroll: true, onSuccess: expect.any(Function) }),
        );
    });

    it('после успешной смены панель закрывается, фокус возвращается на кнопку города', async () => {
        post.mockImplementation(
            (_url: string, _data: unknown, options: { onSuccess: () => void }) => {
                options.onSuccess();
            },
        );
        render(<CitySelect city={moscow} />);
        await open();

        fireEvent.click(within(panelOrFail()).getByRole('button', { name: 'Санкт-Петербург' }));

        expect(panel()).toBeNull();
        expect(trigger()).toHaveFocus();
    });

    it('ошибка смены города — панель остаётся, сообщение о сбое', async () => {
        post.mockImplementation(
            (_url: string, _data: unknown, options: { onError: () => void }) => {
                options.onError();
            },
        );
        render(<CitySelect city={moscow} />);
        await open();

        fireEvent.click(within(panelOrFail()).getByRole('button', { name: 'Санкт-Петербург' }));

        expect(panel()).toBeInTheDocument();
        expect(await screen.findByText(ru.city.saveError)).toBeInTheDocument();
    });

    it('429 при смене — понятное сообщение о лимите вместо окна с ответом сервера (3.1.12)', async () => {
        const preventDefault = vi.fn();
        post.mockImplementation(
            (_url: string, _data: unknown, options: { onFinish: () => void }) => {
                listeners.invalid?.({ detail: { response: { status: 429 } }, preventDefault });
                options.onFinish();
            },
        );
        render(<CitySelect city={moscow} />);
        await open();

        fireEvent.click(within(panelOrFail()).getByRole('button', { name: 'Санкт-Петербург' }));

        expect(preventDefault).toHaveBeenCalled();
        expect(panel()).toBeInTheDocument();
        expect(await screen.findByText(ru.city.rateLimited)).toBeInTheDocument();
        expect(listeners.invalid).toBeUndefined();
    });
});

describe('CitySelect: закрытие', () => {
    it('Esc закрывает панель и возвращает фокус на кнопку', async () => {
        render(<CitySelect city={moscow} />);
        await open();

        act(() => {
            fireEvent.keyDown(document, { key: 'Escape' });
        });

        expect(panel()).toBeNull();
        expect(trigger()).toHaveFocus();
    });

    it('клик вне панели закрывает её', async () => {
        render(
            <>
                <CitySelect city={moscow} />
                <button type="button">Вне панели</button>
            </>,
        );
        await open();

        fireEvent.pointerDown(screen.getByRole('button', { name: 'Вне панели' }));

        expect(panel()).toBeNull();
    });
});

describe('CitySelect: клавиатура и закрытие кнопкой', () => {
    it('стрелки вверх и вниз переводят фокус по списку городов', async () => {
        render(<CitySelect city={moscow} />);
        await open();

        const items = Array.from(panelOrFail().querySelectorAll<HTMLElement>('.ym-city__item'));
        items[0]?.focus();
        fireEvent.keyDown(items[0] as HTMLElement, { key: 'ArrowDown' });
        expect(items[1]).toHaveFocus();

        fireEvent.keyDown(items[1] as HTMLElement, { key: 'ArrowDown' });
        expect(items[2]).toHaveFocus();

        fireEvent.keyDown(items[2] as HTMLElement, { key: 'ArrowUp' });
        expect(items[1]).toHaveFocus();
    });

    it('кнопка закрытия в панели закрывает окно и возвращает фокус на кнопку города', async () => {
        render(<CitySelect city={moscow} />);
        await open();

        fireEvent.click(screen.getByRole('button', { name: ru.city.close }));

        expect(panel()).toBeNull();
        expect(trigger()).toHaveFocus();
    });
});

describe('CitySelect: окно входа', () => {
    it('при открытии окна входа панель закрывается без возврата фокуса и сбрасывает сбой', async () => {
        post.mockImplementation(
            (_url: string, _data: unknown, options: { onError: () => void }) => {
                options.onError();
            },
        );
        render(<CitySelect city={moscow} />);
        await open();
        fireEvent.click(within(panelOrFail()).getByRole('button', { name: 'Санкт-Петербург' }));
        expect(await screen.findByText(ru.city.saveError)).toBeInTheDocument();

        act(() => openLogin({ returnTo: '/' }));

        expect(panel()).toBeNull();
        expect(trigger()).toHaveAttribute('aria-expanded', 'false');
        expect(trigger()).not.toHaveFocus();

        act(() => closeLogin());

        expect(panel()).toBeNull();
        fireEvent.click(trigger());
        expect(panelOrFail()).toBeInTheDocument();
        expect(screen.queryByText(ru.city.saveError)).toBeNull();
    });

    it('панель исчезает в том же кадре, где открылось окно входа: два окна сразу не видны (3.1.12)', async () => {
        // Проба смотрит в DOM на коммите, где появилось окно входа, — до пассивных эффектов.
        const seen: boolean[] = [];
        function Probe() {
            const request = useLoginRequest();
            useLayoutEffect(() => {
                if (request === null) return;
                seen.push(document.getElementById('site-city-panel') !== null);
            }, [request]);
            return null;
        }
        render(
            <>
                <CitySelect city={moscow} />
                <Probe />
            </>,
        );
        await open();

        act(() => openLogin({ returnTo: '/' }));
        act(() => closeLogin());

        expect(seen).toEqual([false]);
    });
});

describe('CitySelect: словарь', () => {
    it('в интерфейсе нет запрещённых слов (AGENTS.md §5)', async () => {
        render(<CitySelect city={moscow} />);
        await open();

        expect(document.body.textContent).not.toMatch(/гир|сетап|Фермата/i);
    });
});

describe('CitySelect: справочник', () => {
    it('грузится один раз за страницу: повторное открытие панели берёт готовый список', async () => {
        render(<CitySelect city={moscow} />);
        await open();
        const loads = () =>
            fetchMock.mock.calls.filter(([url]) => String(url).split('?')[0] === '/cities').length;
        expect(loads()).toBe(1);

        fireEvent.click(within(panelOrFail()).getByRole('button', { name: ru.city.close }));
        fireEvent.click(trigger());

        await waitFor(() =>
            expect(panelOrFail().querySelectorAll('.ym-city__item').length).toBeGreaterThan(0),
        );
        expect(loads()).toBe(1);
    });
});
