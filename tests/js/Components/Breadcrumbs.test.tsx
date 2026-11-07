import { render, screen, within } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

import Breadcrumbs from '@/Components/Breadcrumbs';

vi.mock('@inertiajs/react', () => ({
    Link: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

describe('Breadcrumbs', () => {
    it('навигация «Хлебные крошки»: ссылки, а последний элемент — текущая страница без ссылки', () => {
        render(
            <Breadcrumbs
                items={[
                    { label: 'Главная', href: '/' },
                    { label: 'Барахолка', href: '/baraholka' },
                    { label: 'Гитары' },
                ]}
            />,
        );

        const nav = screen.getByRole('navigation', { name: 'Хлебные крошки' });
        expect(
            within(nav)
                .getAllByRole('link')
                .map((a) => a.getAttribute('href')),
        ).toEqual(['/', '/baraholka']);
        const current = nav.querySelector('[aria-current="page"]');
        expect(current?.textContent).toBe('Гитары');
        expect(current?.tagName).not.toBe('A');
    });

    it('разделители скрыты от экранного диктора', () => {
        render(<Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Барахолка' }]} />);

        const separators = screen
            .getByRole('navigation', { name: 'Хлебные крошки' })
            .querySelectorAll('[aria-hidden="true"]');
        expect(separators).toHaveLength(1);
    });

    it('зона нажатия ссылки не меньше 32 px по высоте через класс ДС (min-height в стилях)', () => {
        render(<Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Барахолка' }]} />);

        expect(screen.getByRole('link', { name: 'Главная' })).toHaveClass('ym-crumbs__link');
    });
});
