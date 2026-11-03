import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Home from '@/Pages/Home';

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: { flags: {} } }),
    Head: () => null,
}));

describe('Home в PublicLayout', () => {
    it('страница объявляет постоянную раскладку PublicLayout', () => {
        expect(Home.layout).toBeTypeOf('function');
    });

    it('в раскладке: шапка, единственный main с заголовком «ЯМузыкант», подвал', () => {
        const layout = Home.layout as (page: React.ReactNode) => React.ReactNode;
        render(<>{layout(<Home />)}</>);

        expect(screen.getAllByRole('main')).toHaveLength(1);
        expect(screen.getByRole('banner')).toBeInTheDocument();
        expect(screen.getByRole('contentinfo')).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1, name: 'ЯМузыкант' })).toBeInTheDocument();
    });
});
