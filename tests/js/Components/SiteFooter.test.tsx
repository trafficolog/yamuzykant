import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SiteFooter from '@/Components/SiteFooter';

let flags: Record<string, boolean> = {};

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: { flags } }),
}));

const text = (element: Element): string => (element.textContent ?? '').replace(/\s+/g, ' ').trim();
const ALL_ON = {
    catalog_new: true,
    accessories: true,
    masters: true,
    sale_prices: true,
    safe_deal: true,
    companies: true,
    delivery_service: true,
};

const services = () => screen.getByRole('navigation', { name: 'Сервисы' });
const serviceNames = () => within(services()).getAllByRole('link').map(text);

beforeEach(() => {
    flags = {};
});

describe('SiteFooter', () => {
    it('все флаги выключены: полоса сервисов — только «Барахолка», доставка скрыта флагом delivery_service', () => {
        render(<SiteFooter />);

        expect(serviceNames()).toEqual(['Барахолка']);
        expect(screen.queryByRole('link', { name: 'Доставка с упаковкой' })).toBeNull();
    });

    it('флаг delivery_service включает «Доставка с упаковкой» и только её', () => {
        flags = { delivery_service: true };
        render(<SiteFooter />);

        expect(serviceNames()).toEqual(['Барахолка', 'Доставка с упаковкой']);
    });

    it('все флаги включены: семь сервисов в порядке макета', () => {
        flags = ALL_ON;
        render(<SiteFooter />);

        expect(serviceNames()).toEqual([
            'Каталог',
            'Барахолка',
            'Аксессуары',
            'Мастера',
            'Цены на б/у',
            'Безопасная сделка',
            'Доставка с упаковкой',
        ]);
    });

    it('ссылки на разделы вне MVP не рендерятся без флагов', () => {
        render(<SiteFooter />);

        for (const label of [
            'Стать мастером',
            'Кабинет мастерской',
            'Магазинам-партнёрам',
            'Цены на б/у',
            'Как работает безопасная сделка',
        ]) {
            expect(screen.queryByRole('link', { name: label }), label).not.toBeInTheDocument();
        }
    });

    it('флаги включают свои ссылки по одному', () => {
        flags = { masters: true };
        render(<SiteFooter />);

        expect(screen.getByRole('link', { name: 'Стать мастером' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Кабинет мастерской' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Магазинам-партнёрам' })).toBeNull();
    });

    it('флаг companies включает «Магазинам-партнёрам»', () => {
        flags = { companies: true };
        render(<SiteFooter />);

        expect(screen.getByRole('link', { name: 'Магазинам-партнёрам' })).toBeInTheDocument();
    });

    it('заголовок колонки «Продавцам» без флага masters и «Продавцам и мастерам» с ним', () => {
        const { unmount } = render(<SiteFooter />);
        expect(screen.getByRole('heading', { name: 'Продавцам' })).toBeInTheDocument();
        unmount();

        flags = { masters: true };
        render(<SiteFooter />);
        expect(screen.getByRole('heading', { name: 'Продавцам и мастерам' })).toBeInTheDocument();
    });

    it('соцсети: Telegram, ВКонтакте, MAX — без YouTube', () => {
        render(<SiteFooter />);

        for (const label of ['Telegram', 'ВКонтакте', 'MAX']) {
            expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
        }
        expect(screen.queryByText('YouTube')).not.toBeInTheDocument();
    });

    it('подвал — ориентир contentinfo, в тексте нет слов вне словаря', () => {
        flags = ALL_ON;
        render(<SiteFooter />);

        expect(screen.getByRole('contentinfo')).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/гир|фермат|сетап/i);
    });

    it('«Написать в поддержку», почта и юридические ссылки на месте', () => {
        render(<SiteFooter />);

        expect(screen.getByRole('link', { name: 'Написать в поддержку' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'help@yamuzykant.ru' })).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Пользовательское соглашение' }),
        ).toBeInTheDocument();
    });
});
