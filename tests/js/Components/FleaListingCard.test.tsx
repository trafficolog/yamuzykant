import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import FleaListingCard from '@/Components/FleaListingCard';

// BR-11, карточка 3.1.9: подпись цены задаёт CSS (`--price-label` + `:empty::after`), поэтому она есть
// в серверной разметке и работает без JS. Портала и useLayoutEffect в карточке больше нет.

const base = { title: 'Fender Japan ST62, 1994', href: '/listings/1' };

describe('FleaListingCard: подпись цены без JS', () => {
    it('SSR: price = null — «Договорная» в --price-label, блок цены пуст', () => {
        const html = renderToString(<FleaListingCard {...base} price={null} />);

        expect(html).toContain('--price-label:&quot;Договорная&quot;');
        expect(html).toMatch(/<span class="ym-price__now"><\/span>/);
    });

    it('SSR: price = 0 — «Бесплатно», «0 ₽» нет', () => {
        const html = renderToString(<FleaListingCard {...base} price={0} />);

        expect(html).toContain('--price-label:&quot;Бесплатно&quot;');
        expect(html).not.toMatch(/(^|[^\d])0\s₽/);
    });

    it('SSR: сумма — цена в блоке, --price-label не задан', () => {
        const html = renderToString(<FleaListingCard {...base} price={184_500} />);

        expect(html).toContain('184 500');
        expect(html).not.toContain('--price-label');
    });

    it('в браузере то же значение на обёртке, без портала в блок цены', () => {
        const { container } = render(<FleaListingCard {...base} price={null} />);

        const wrapper = container.querySelector<HTMLElement>('.ym-flea__card');
        expect(wrapper?.style.getPropertyValue('--price-label')).toBe('"Договорная"');
        expect(container.querySelector('.ym-price__now')?.textContent).toBe('');
    });
});
