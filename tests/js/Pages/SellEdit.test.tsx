import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ListingPhoto } from '@/Components/photoUploaderApi';
import SellCreate from '@/Pages/Sell/Create';

// UC-L3 (2.1.5): «Изменить» — та же форма продажи с содержимым опубликованного объявления, без черновика.

const put = vi.fn();
const post = vi.fn();
let shared: Record<string, unknown> = {};

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: shared }),
    Head: () => null,
    router: {
        put: (...args: unknown[]) => put(...args),
        post: (...args: unknown[]) => post(...args),
    },
}));

const photo = (id: number, isSerial = false): ListingPhoto => ({
    id,
    position: id,
    is_serial: isSerial,
    state: 'ready',
    error: null,
    urls: isSerial
        ? null
        : {
              square: { avif: `/m/${id}.avif`, webp: `/m/${id}.webp` },
              wide: { avif: `/m/${id}w.avif`, webp: `/m/${id}w.webp` },
          },
});

const draft = {
    kind_id: 1,
    title: 'Fender American Vintage ’57 Stratocaster',
    model_id: 7,
    year: 2009,
    serial_masked: 'V09****',
    condition: 'excellent' as const,
    description: 'Родной кейс.',
    price_mode: 'amount' as const,
    price: 184_500,
    negotiable: true,
    meet: true,
    ship: false,
};

const view = () =>
    render(
        <SellCreate
            mode="edit"
            listingId="l-1"
            photos={[photo(1, true), photo(2), photo(3)]}
            draft={draft}
        />,
    );

beforeEach(() => {
    put.mockReset();
    post.mockReset();
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) })),
    );
    shared = {
        flags: {},
        categories: [{ id: 1, name: 'Гитары', slug: 'g', icon: 'guitar', children: [] }],
        city: { id: 1, name: 'Москва' },
        errors: {},
    };
});

describe('Sell/Create в режиме «Изменить»', () => {
    it('заголовок и кнопка — про изменение; «Сохранить черновик» нет', () => {
        view();

        expect(
            screen.getByRole('heading', { level: 1, name: 'Изменить объявление' }),
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toBeEnabled();
        expect(screen.queryByRole('button', { name: 'Опубликовать' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Сохранить черновик' })).toBeNull();
    });

    it('форма заполнена из объявления; серийный номер — маской', () => {
        view();

        expect(screen.getByRole('combobox', { name: 'Бренд и модель' })).toHaveValue(
            'Fender American Vintage ’57 Stratocaster',
        );
        expect(screen.getByText(/V09\*\*\*\*/)).toBeInTheDocument();
    });

    it('сохранение отправляет PUT на объявление; серийный номер нетронутый не уходит, фото не менялись', () => {
        view();

        fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }));

        expect(post).not.toHaveBeenCalled();
        expect(put).toHaveBeenCalledTimes(1);
        const [url, data] = put.mock.calls[0] as [string, Record<string, unknown>];
        expect(url).toBe('/listings/l-1');
        expect(data).toMatchObject({
            title: 'Fender American Vintage ’57 Stratocaster',
            model_id: 7,
            price_mode: 'amount',
            price: 184_500,
            photos_changed: false,
        });
        expect(data).not.toHaveProperty('serial');
    });

    it('автосохранение черновика не запускается', () => {
        vi.useFakeTimers();
        view();
        fireEvent.change(screen.getByRole('textbox', { name: 'Год выпуска' }), {
            target: { value: '2010' },
        });
        vi.advanceTimersByTime(6000);
        vi.useRealTimers();

        const draftCalls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
            ([url]) => url === '/sell/draft',
        );
        expect(draftCalls).toHaveLength(0);
    });
});
