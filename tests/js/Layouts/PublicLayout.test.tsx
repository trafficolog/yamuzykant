import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PublicLayout from '@/Layouts/PublicLayout';

let flags: Record<string, boolean> = {};
const headProps: Array<Record<string, unknown>> = [];

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: { flags } }),
    Head: (props: Record<string, unknown>) => {
        headProps.push(props);
        return null;
    },
}));

beforeEach(() => {
    flags = {};
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
        expect(screen.getByRole('link', { name: 'Барахолка' })).toHaveAttribute(
            'aria-current',
            'page',
        );
    });

    it('по умолчанию поиск показан, раздел не выбран', () => {
        render(<PublicLayout>{null}</PublicLayout>);

        expect(screen.getByRole('search')).toBeInTheDocument();
        expect(document.querySelector('[aria-current="page"]')).toBeNull();
    });

    it('город и счётчик сообщений доходят до шапки', () => {
        render(
            <PublicLayout city="Казань" messages={2}>
                {null}
            </PublicLayout>,
        );

        expect(screen.getByRole('button', { name: 'Казань' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Сообщения, 2' })).toBeInTheDocument();
    });
});
