import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SellPublished from '@/Pages/Sell/Published';

// UC-L1 п. 7 (задача 2.1.4): экран «Объявление опубликовано» (премодерация выключена) или «Отправлено на проверку» (включена).

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: {} }),
    Head: () => null,
}));

const listing = {
    id: '9f1c-listing',
    title: 'Fender American Vintage ’57 Stratocaster',
    url: '/listings/9f1c-listing',
};

describe('Объявление опубликовано', () => {
    it('заголовок, срок публикации и название объявления', () => {
        render(<SellPublished status="published" listing={listing} days={60} />);

        expect(
            screen.getByRole('heading', { level: 1, name: 'Продать инструмент' }),
        ).toBeVisible();
        expect(
            screen.getByRole('heading', { level: 2, name: 'Объявление опубликовано' }),
        ).toBeVisible();
        expect(screen.getByText(/Fender American Vintage ’57 Stratocaster/)).toBeVisible();
        expect(screen.getByText(/60 дней/)).toBeVisible();
    });

    it('кнопки «Открыть объявление» (на лот) и «Продать ещё один» (на форму)', () => {
        render(<SellPublished status="published" listing={listing} days={60} />);

        expect(screen.getByRole('link', { name: 'Открыть объявление' })).toHaveAttribute(
            'href',
            '/listings/9f1c-listing',
        );
        expect(screen.getByRole('link', { name: 'Продать ещё один' })).toHaveAttribute(
            'href',
            '/sell',
        );
    });

    it('срок склоняется: 1 день, 2 дня, 60 дней', () => {
        const { rerender } = render(<SellPublished status="published" listing={listing} days={1} />);
        expect(screen.getByText(/1 день/)).toBeVisible();

        rerender(<SellPublished status="published" listing={listing} days={2} />);
        expect(screen.getByText(/2 дня/)).toBeVisible();
    });

    it('запрещённых слов нет, восклицательных знаков нет', () => {
        const { container } = render(<SellPublished status="published" listing={listing} days={60} />);

        expect(container.textContent ?? '').not.toMatch(/!|гир|сетап/i);
    });
});

describe('Отправлено на проверку (флаг premoderation)', () => {
    it('заголовок и пояснение про модератора, срока публикации нет', () => {
        render(<SellPublished status="pending" listing={listing} days={60} />);

        expect(
            screen.getByRole('heading', { level: 2, name: 'Отправлено на проверку' }),
        ).toBeVisible();
        expect(screen.getByText(/Модератор посмотрит фото и описание/)).toBeVisible();
        expect(screen.queryByText(/60 дней/)).toBeNull();
        expect(screen.queryByRole('heading', { name: 'Объявление опубликовано' })).toBeNull();
    });

    it('те же кнопки', () => {
        render(<SellPublished status="pending" listing={listing} days={60} />);

        expect(screen.getByRole('link', { name: 'Открыть объявление' })).toBeVisible();
        expect(screen.getByRole('link', { name: 'Продать ещё один' })).toBeVisible();
    });
});

describe('Каркас', () => {
    it('страница объявляет постоянную раскладку PublicLayout', () => {
        expect(SellPublished.layout).toBeTypeOf('function');
    });
});
