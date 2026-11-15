import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import Home from '@/Pages/Home';

vi.mock('@inertiajs/react', () => ({
    router: { get: vi.fn(), visit: vi.fn(), on: vi.fn(() => () => undefined) },
    usePage: () => ({ props: { flags: {}, city: { id: 1, name: 'Москва' } }, url: '/' }),
    Head: () => null,
    Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
        <a href={href}>{children}</a>
    ),
}));

const props: ComponentProps<typeof Home> = {
    rails: { fresh: [], negotiable: [] },
    cityLabel: 'г. Москва',
    categories: [],
};

describe('Home в PublicLayout', () => {
    it('страница объявляет постоянную раскладку PublicLayout', () => {
        expect(Home.layout).toBeTypeOf('function');
    });

    it('в раскладке: шапка, единственный main с заголовком h1, подвал', () => {
        const layout = Home.layout as (page: React.ReactNode) => React.ReactNode;
        render(<>{layout(<Home {...props} />)}</>);

        expect(screen.getAllByRole('main')).toHaveLength(1);
        expect(screen.getByRole('banner')).toBeInTheDocument();
        expect(screen.getByRole('contentinfo')).toBeInTheDocument();
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^ЯМузыкант/);
    });

    it('поиск шапки открывает Барахолку с запросом (на главной нет своей выдачи)', async () => {
        const { router } = await import('@inertiajs/react');
        const layout = Home.layout as (page: React.ReactNode) => React.ReactNode;
        render(<>{layout(<Home {...props} />)}</>);

        fireEvent.change(screen.getByRole('searchbox'), { target: { value: ' Telecaster ' } });
        fireEvent.submit(screen.getByRole('search'));

        expect(router.get).toHaveBeenCalledWith('/baraholka', { q: 'Telecaster' });
    });
});
