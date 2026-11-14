import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ListingPhoto } from '@/Components/photoUploaderApi';
import SellCreate from '@/Pages/Sell/Create';

// Ревью PR #126 (2.1.3), круг 1: пределы на клиенте, фокус после ошибок сервера, превью без «0 ₽» до гидратации.

const post = vi.fn();
let shared: Record<string, unknown> = {};

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: shared }),
    Head: () => null,
    router: { post: (...args: unknown[]) => post(...args) },
}));

const categories = ['Гитары', 'Ударные'].map((name, index) => ({
    id: index + 1,
    name,
    slug: `kind-${index + 1}`,
    icon: 'guitar',
    children: [],
}));

const photo = (id: number, overrides: Partial<ListingPhoto> = {}): ListingPhoto => ({
    id,
    position: id,
    is_serial: false,
    state: 'ready',
    error: null,
    urls: {
        square: { avif: `/a/${id}`, webp: `/w/${id}` },
        wide: { avif: `/a/${id}`, webp: `/w/${id}` },
    },
    ...overrides,
});
const THREE = [photo(1, { is_serial: true, urls: null }), photo(2), photo(3)];

const renderSell = () => render(<SellCreate listingId="draft-1" photos={THREE} />);
const modelField = () => screen.getByRole('combobox', { name: 'Бренд и модель' });
const publish = () => screen.getByRole('button', { name: 'Опубликовать' });

function fillRequired() {
    fireEvent.change(modelField(), { target: { value: 'Fender Stratocaster' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Отличное' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Цена' }), {
        target: { value: '184500' },
    });
}

beforeEach(() => {
    post.mockReset();
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) })),
    );
    shared = { flags: {}, categories, city: { id: 1, name: 'Москва' }, errors: {} };
});

describe('пределы полей на клиенте', () => {
    it('maxLength у названия и серийного номера', () => {
        renderSell();

        expect(modelField()).toHaveAttribute('maxlength', '120');
        expect(screen.getByRole('textbox', { name: 'Серийный номер' })).toHaveAttribute(
            'maxlength',
            '64',
        );
    });

    it('год вне диапазона: ошибка у поля, кнопка неактивна, отправки нет', () => {
        renderSell();
        fillRequired();
        fireEvent.change(screen.getByRole('textbox', { name: 'Год выпуска' }), {
            target: { value: '1700' },
        });

        expect(screen.getByRole('textbox', { name: 'Год выпуска' })).toHaveAccessibleDescription(
            /Укажите год выпуска от 1800 до/,
        );
        expect(publish()).toBeDisabled();

        fireEvent.change(screen.getByRole('textbox', { name: 'Год выпуска' }), {
            target: { value: '2009' },
        });
        expect(publish()).toBeEnabled();
    });

    it('описание длиннее 5000 символов: ошибка у поля, кнопка неактивна', () => {
        renderSell();
        fillRequired();
        fireEvent.change(screen.getByRole('textbox', { name: 'Описание' }), {
            target: { value: 'а'.repeat(5001) },
        });

        expect(screen.getByRole('textbox', { name: 'Описание' })).toHaveAccessibleDescription(
            'Описание длиннее 5000 символов — сократите его.',
        );
        expect(publish()).toBeDisabled();
    });
});

describe('фокус после ответа сервера с ошибками', () => {
    const submitAndFail = (errors: Record<string, string>) => {
        fillRequired();
        fireEvent.click(publish());
        const options = post.mock.calls[0]?.[2] as {
            onError: (errors: Record<string, string>) => void;
        };
        act(() => options.onError(errors));
    };

    it('ошибка поля — фокус на первом проблемном поле по порядку формы', async () => {
        shared = {
            ...shared,
            errors: { price: 'Укажите цену.', title: 'Укажите бренд и модель.' },
        };
        renderSell();

        submitAndFail({ price: 'Укажите цену.', title: 'Укажите бренд и модель.' });

        await waitFor(() => expect(modelField()).toHaveFocus());
    });

    it('ошибка цены — фокус на поле цены', async () => {
        shared = { ...shared, errors: { price: 'Укажите цену.' } };
        renderSell();

        submitAndFail({ price: 'Укажите цену.' });

        await waitFor(() => expect(screen.getByRole('textbox', { name: 'Цена' })).toHaveFocus());
    });

    it('ошибки без поля (фото, передача) — фокус на сообщении над кнопкой', async () => {
        shared = { ...shared, errors: { photos: 'ещё 1 фото' } };
        renderSell();

        submitAndFail({ photos: 'ещё 1 фото' });

        await waitFor(() => {
            const box = screen.getByRole('alert').closest('[tabindex="-1"]');
            expect(box).not.toBeNull();
            expect(box).toHaveFocus();
        });
    });
});

describe('превью до гидратации', () => {
    it('в серверной разметке карточки с «0 ₽» нет: превью рисуется только в браузере', () => {
        const html = renderToString(<SellCreate listingId="draft-1" photos={THREE} />);

        expect(html).not.toMatch(/0\s₽/);
        expect(html).not.toContain('ym-card');
        expect(html).toContain('Так лот увидят покупатели');
    });

    it('в браузере после загрузки карточка на месте', async () => {
        renderSell();

        await waitFor(() => expect(document.querySelector('.ym-card')).not.toBeNull());
    });
});
