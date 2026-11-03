import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PublicLayout from '@/Layouts/PublicLayout';

let flags: Record<string, boolean> = {};
let city: { id: number; name: string } | null = null;
const headProps: Array<Record<string, unknown>> = [];

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: { flags, city } }),
    Head: (props: Record<string, unknown>) => {
        headProps.push(props);
        return null;
    },
}));

beforeEach(() => {
    flags = {};
    city = null;
    headProps.length = 0;
});

describe('PublicLayout', () => {
    it('собирает шапку, main и подвал как ориентиры страницы', () => {
        render(
            <PublicLayout>
                <h1>Страница</h1>
            </PublicLayout>,
        );

        expect(screen.getByRole('banner')).toBeInTheDocument();
        expect(screen.getByRole('main')).toBeInTheDocument();
        expect(screen.getByRole('contentinfo')).toBeInTheDocument();
        expect(
            within(screen.getByRole('main')).getByRole('heading', { name: 'Страница' }),
        ).toBeInTheDocument();
    });

    it('первая ссылка — «Перейти к содержимому», ведёт на id у main', () => {
        render(<PublicLayout>{null}</PublicLayout>);

        const skip = screen.getAllByRole('link')[0];
        expect(skip).toHaveTextContent('Перейти к содержимому');
        const target = skip?.getAttribute('href')?.replace('#', '');
        expect(target).toBeTruthy();
        expect(screen.getByRole('main')).toHaveAttribute('id', target);
    });

    it('main принимает программный фокус для перехода по skip-link', () => {
        render(<PublicLayout>{null}</PublicLayout>);

        expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
    });

    it('передаёт <Head> заголовок страницы', () => {
        render(<PublicLayout title="Барахолка">{null}</PublicLayout>);

        expect(headProps.some((props) => props.title === 'Барахолка')).toBe(true);
    });

    it('active и search пробрасываются в шапку', () => {
        render(
            <PublicLayout active="flea" search={false}>
                {null}
            </PublicLayout>,
        );

        expect(screen.queryByRole('search')).not.toBeInTheDocument();
        expect(
            within(screen.getByRole('banner')).getByRole('link', { name: 'Барахолка' }),
        ).toHaveAttribute('aria-current', 'page');
    });

    it('по умолчанию поиск показан, раздел не выбран', () => {
        render(<PublicLayout>{null}</PublicLayout>);

        expect(screen.getByRole('search')).toBeInTheDocument();
        expect(document.querySelector('[aria-current="page"]')).toBeNull();
    });

    it('город из shared prop `city` доходит до шапки без передачи страницей; счётчик сообщений — тоже', () => {
        city = { id: 2, name: 'Казань' };
        render(<PublicLayout messages={2}>{null}</PublicLayout>);

        expect(screen.getByRole('button', { name: 'Казань' })).toBeInTheDocument();
        expect(
            within(screen.getByRole('banner')).getByRole('link', { name: 'Сообщения, 2' }),
        ).toBeInTheDocument();
    });
});

describe('PublicLayout: нижняя панель', () => {
    const bar = () => screen.getByRole('navigation', { name: 'Нижнее меню' });

    it('нижняя панель — последний блок каркаса, после подвала', () => {
        render(<PublicLayout>{null}</PublicLayout>);

        const footer = screen.getByRole('contentinfo');
        expect(
            footer.compareDocumentPosition(bar()) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('счётчик сообщений доходит до нижней панели', () => {
        render(<PublicLayout messages={2}>{null}</PublicLayout>);

        expect(within(bar()).getByRole('link', { name: 'Сообщения, 2' })).toBeInTheDocument();
    });

    it('без сообщений счётчика на панели нет', () => {
        render(<PublicLayout>{null}</PublicLayout>);

        expect(within(bar()).getByRole('link', { name: 'Сообщения' })).toBeInTheDocument();
    });

    it('tab отмечает вкладку текущего раздела', () => {
        render(<PublicLayout tab="home">{null}</PublicLayout>);

        const current = bar().querySelector('[aria-current="page"]');
        expect(current).toHaveTextContent('Главная');
    });
});
