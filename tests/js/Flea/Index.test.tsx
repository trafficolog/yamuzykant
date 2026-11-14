import { fireEvent, render, screen, within } from '@testing-library/react';
import type { AnchorHTMLAttributes, ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FleaIndex from '@/Pages/Flea/Index';
import { EMPTY_FILTERS } from '@/Pages/Flea/query';

const { get, on } = vi.hoisted(() => ({ get: vi.fn(), on: vi.fn(() => () => undefined) }));

vi.mock('@inertiajs/react', () => ({
    router: { get, on },
    usePage: () => ({ props: { flags: {}, city: { id: 1, name: 'Москва' } }, url: '/baraholka' }),
    Head: () => null,
    Link: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

type Props = ComponentProps<typeof FleaIndex>;

const card = (
    n: number,
    extra: Partial<Props['listings'][number]> = {},
): Props['listings'][number] => ({
    id: `id-${n}`,
    title: `Гитара ${n}`,
    price: 184_500,
    condition: 'excellent',
    city: 'Москва',
    ship: false,
    negotiable: true,
    posted: '2 ч назад',
    ...extra,
});

const CONDITIONS = [
    { value: 'new', label: 'Новое', count: 0 },
    { value: 'mint', label: 'Как новое', count: 1 },
    { value: 'excellent', label: 'Отличное', count: 5 },
    { value: 'very-good', label: 'Очень хорошее', count: 3 },
    { value: 'good', label: 'Хорошее', count: 2 },
    { value: 'fair', label: 'Удовлетворительное', count: 1 },
    { value: 'poor', label: 'Плохое', count: 0 },
    { value: 'parts', label: 'На запчасти', count: 0 },
];

const CATEGORIES: Props['categories'] = [
    {
        id: 1,
        name: 'Гитары',
        slug: 'gitary',
        icon: 'guitar',
        children: [
            { id: 2, name: 'Электрогитары', slug: 'elektrogitary', icon: null, children: [] },
            { id: 3, name: 'Бас-гитары', slug: 'bas-gitary', icon: null, children: [] },
        ],
    },
    { id: 4, name: 'Ударные', slug: 'udarnye', icon: 'drum', children: [] },
];

function props(overrides: Partial<Props> = {}): Props {
    return {
        listings: [card(1), card(2), card(3)],
        pagination: { page: 1, pages: 1, total: 3, perPage: 24 },
        filters: EMPTY_FILTERS,
        sorts: ['new', 'cheap', 'expensive'],
        conditions: CONDITIONS,
        category: null,
        categoryCounts: {},
        categories: CATEGORIES,
        ...overrides,
    };
}

const text = (element: Element): string => (element.textContent ?? '').replace(/\s+/g, ' ').trim();
const aside = () => screen.getByRole('complementary', { name: 'Фильтры' });
const lastGet = () =>
    get.mock.calls.at(-1) as [string, Record<string, unknown>, Record<string, unknown>];

beforeEach(() => {
    get.mockReset();
    on.mockClear();
});

describe('Flea/Index: каркас', () => {
    it('h1 «Барахолка» один; счётчик «Найдено N лотов» с русским склонением', () => {
        const { rerender } = render(<FleaIndex {...props()} />);
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Барахолка');
        expect(screen.getByText('Найдено 3 лота')).toBeInTheDocument();

        rerender(
            <FleaIndex
                {...props({ pagination: { page: 1, pages: 1, total: 18_760, perPage: 24 } })}
            />,
        );
        expect(text(screen.getByText(/^Найдено/))).toBe('Найдено 18 760 лотов');

        rerender(
            <FleaIndex {...props({ pagination: { page: 1, pages: 1, total: 21, perPage: 24 } })} />,
        );
        expect(screen.getByText(/^Найдено/)).toHaveTextContent('Найдено 21 лот');
    });

    it('карточки ведут на страницу объявления /listings/{id} (3.1.5)', () => {
        render(<FleaIndex {...props()} />);

        const hrefs = screen
            .getAllByRole('link')
            .map((a) => a.getAttribute('href'))
            .filter((href) => href?.startsWith('/listings/'));
        expect(new Set(hrefs)).toEqual(
            new Set(['/listings/id-1', '/listings/id-2', '/listings/id-3']),
        );
    });

    it('в категории h1 — название категории, крошки ведут вверх по дереву и текущая без ссылки', () => {
        render(
            <FleaIndex
                {...props({
                    category: {
                        name: 'Электрогитары',
                        path: 'gitary/elektrogitary',
                        crumbs: [
                            { name: 'Гитары', path: 'gitary' },
                            { name: 'Электрогитары', path: 'gitary/elektrogitary' },
                        ],
                    },
                })}
            />,
        );

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Электрогитары');
        const crumbs = screen.getByRole('navigation', { name: 'Хлебные крошки' });
        expect(
            within(crumbs)
                .getAllByRole('link')
                .map((a) => [text(a), a.getAttribute('href')]),
        ).toEqual([
            ['Главная', '/'],
            ['Барахолка', '/baraholka'],
            ['Гитары', '/baraholka/gitary'],
        ]);
        expect(crumbs.querySelector('[aria-current="page"]')).toHaveTextContent('Электрогитары');
    });

    it('без категории крошки: Главная → Барахолка (текущая)', () => {
        render(<FleaIndex {...props()} />);

        const crumbs = screen.getByRole('navigation', { name: 'Хлебные крошки' });
        expect(crumbs.querySelector('[aria-current="page"]')).toHaveTextContent('Барахолка');
    });

    it('сетка: по карточке на объявление, разряды цены неразрывным пробелом, у доставки подпись', () => {
        render(<FleaIndex {...props({ listings: [card(1, { ship: true }), card(2)] })} />);

        const cards = screen.getAllByRole('article');
        expect(cards).toHaveLength(2);
        const first = cards[0] as HTMLElement;
        const second = cards[1] as HTMLElement;
        expect(within(first).getByRole('heading', { level: 3 })).toHaveTextContent('Гитара 1');
        expect(first.textContent).toContain('184 500');
        expect(text(first)).toContain('Доставка');
        expect(text(second)).not.toContain('Доставка');
        expect(text(first)).toContain('Москва');
        expect(text(first)).toContain('2 ч назад');
    });

    it('флаги вне MVP (R1): нет переключателя Каталог / Барахолка, чипа и значка «Безопасная сделка»', () => {
        render(<FleaIndex {...props()} />);

        expect(screen.queryByText('Безопасная сделка')).toBeNull();
        expect(screen.queryByLabelText('Безопасная сделка')).toBeNull();
        expect(screen.queryByText(/Каталог/)).toBeNull();
        expect(document.querySelector('.ym-switch')).toBeNull();
        expect(screen.queryByText(/Проверено мастером/)).toBeNull();
        expect(screen.queryByText(/Рядом со мной|Ближе ко мне/)).toBeNull();
    });
});

describe('Flea/Index: фильтры', () => {
    it('панель «Фильтры» с группами Состояние, Цена и «Покупка и доставка»', () => {
        render(<FleaIndex {...props()} />);

        const panel = within(aside());
        expect(panel.getByRole('heading', { level: 2, name: 'Фильтры' })).toBeInTheDocument();
        expect(panel.getByRole('group', { name: 'Состояние' })).toBeInTheDocument();
        expect(panel.getByRole('group', { name: 'Цена' })).toBeInTheDocument();
        expect(panel.getByRole('group', { name: 'Покупка и доставка' })).toBeInTheDocument();
        expect(panel.queryByRole('button', { name: /Сбросить все/ })).toBeNull();
    });

    it('чипы состояний: 8 ступеней, счётчики, пустые отключены', () => {
        render(<FleaIndex {...props()} />);

        const group = within(within(aside()).getByRole('group', { name: 'Состояние' }));
        expect(group.getAllByRole('button')).toHaveLength(8);
        expect(group.getByRole('button', { name: /^Отличное\s*5$/ })).toHaveAttribute(
            'aria-pressed',
            'false',
        );
        expect(group.getByRole('button', { name: /^Новое/ })).toBeDisabled();
        expect(group.getByRole('button', { name: /^Хорошее/ })).toBeEnabled();
    });

    it('нажатие на состояние обновляет адрес (condition[]), сохраняя прокрутку', () => {
        render(<FleaIndex {...props()} />);

        fireEvent.click(within(aside()).getByRole('button', { name: /^Хорошее/ }));

        const [url, data, options] = lastGet();
        expect(url).toBe('/baraholka');
        expect(data).toEqual({ condition: ['good'] });
        expect(options).toMatchObject({ preserveScroll: true, preserveState: true });
    });

    it('выбранное состояние нажато (aria-pressed), повторное нажатие снимает его', () => {
        render(
            <FleaIndex
                {...props({ filters: { ...EMPTY_FILTERS, condition: ['good', 'mint'] } })}
            />,
        );

        const chip = within(aside()).getByRole('button', { name: /^Хорошее/ });
        expect(chip).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(chip);

        expect(lastGet()[1]).toEqual({ condition: ['mint'] });
    });

    it('цена: поля «от» и «до» применяются по Enter и по уходу фокуса, только целые рубли', () => {
        render(<FleaIndex {...props()} />);
        const from = within(aside()).getByLabelText('от');
        const to = within(aside()).getByLabelText('до');

        fireEvent.change(from, { target: { value: '50 000' } });
        fireEvent.keyDown(from, { key: 'Enter' });
        expect(lastGet()[1]).toEqual({ price_from: 50_000 });

        fireEvent.change(to, { target: { value: '90000abc' } });
        fireEvent.blur(to);
        expect(lastGet()[1]).toEqual({ price_from: 50_000, price_to: 90_000 });
    });

    it('цена: пустое поле убирает границу; значение не меняется — запроса нет', () => {
        render(<FleaIndex {...props({ filters: { ...EMPTY_FILTERS, priceFrom: 50_000 } })} />);
        const from = within(aside()).getByLabelText('от');
        expect(from).toHaveValue('50000');

        fireEvent.blur(from);
        expect(get).not.toHaveBeenCalled();

        fireEvent.change(from, { target: { value: '' } });
        fireEvent.blur(from);
        expect(lastGet()[1]).toEqual({});
    });

    it('«Готов к торгу» и «Доставка» — чипы-переключатели', () => {
        render(<FleaIndex {...props()} />);
        const deal = within(within(aside()).getByRole('group', { name: 'Покупка и доставка' }));

        fireEvent.click(deal.getByRole('button', { name: 'Готов к торгу' }));
        expect(lastGet()[1]).toEqual({ negotiable: 1 });

        fireEvent.click(deal.getByRole('button', { name: 'Доставка' }));
        expect(lastGet()[1]).toEqual({ ship: 1 });
    });

    it('«Сбросить все» появляется при фильтрах и очищает их, оставляя сортировку', () => {
        render(
            <FleaIndex {...props({ filters: { ...EMPTY_FILTERS, ship: true, sort: 'cheap' } })} />,
        );

        fireEvent.click(within(aside()).getByRole('button', { name: 'Сбросить все' }));

        expect(lastGet()[1]).toEqual({ sort: 'cheap' });
    });

    it('активные фильтры — снимаемые чипы над выдачей', () => {
        render(
            <FleaIndex
                {...props({
                    filters: { ...EMPTY_FILTERS, condition: ['good'], ship: true, priceTo: 90_000 },
                })}
            />,
        );

        const active = screen.getByRole('group', { name: 'Выбранные фильтры' });
        expect(within(active).getAllByRole('button').map(text)).toEqual([
            'Хорошее',
            'до 90 000 ₽',
            'Доставка',
        ]);

        fireEvent.click(within(active).getByRole('button', { name: 'Доставка' }));
        expect(lastGet()[1]).toEqual({ condition: ['good'], price_to: 90_000 });
    });

    it('категории: ссылки на ветку, текущая помечена, фильтры сохраняются в ссылках', () => {
        render(
            <FleaIndex
                {...props({
                    filters: { ...EMPTY_FILTERS, ship: true },
                    category: {
                        name: 'Гитары',
                        path: 'gitary',
                        crumbs: [{ name: 'Гитары', path: 'gitary' }],
                    },
                    categoryCounts: { gitary: 7, 'gitary/elektrogitary': 5 },
                })}
            />,
        );

        const nav = within(within(aside()).getByRole('navigation', { name: 'Категория' }));
        expect(nav.getByRole('link', { name: /Электрогитары/ })).toHaveAttribute(
            'href',
            '/baraholka/gitary/elektrogitary?ship=1',
        );
        expect(nav.getByRole('link', { name: /Ударные/ })).toHaveAttribute(
            'href',
            '/baraholka/udarnye?ship=1',
        );
        expect(nav.getByRole('link', { name: /Гитары/ })).toHaveAttribute('aria-current', 'page');
        expect(text(nav.getByRole('link', { name: /Электрогитары/ }))).toContain('5');
    });

    it('мобильная раскладка: кнопка «Фильтры» раскрывает панель (aria-expanded)', () => {
        render(<FleaIndex {...props()} />);

        const toggle = screen.getByRole('button', { name: /Фильтры/, expanded: false });
        expect(toggle).toHaveAttribute('aria-controls', aside().id);

        fireEvent.click(toggle);

        expect(screen.getByRole('button', { name: /Фильтры/, expanded: true })).toBeInTheDocument();
    });
});

describe('Flea/Index: сортировка', () => {
    it('три сортировки: свежие, дешевле, дороже; «Ближе ко мне» нет', () => {
        render(<FleaIndex {...props()} />);

        const select = screen.getByLabelText('Сортировка');
        expect(within(select).getAllByRole('option').map(text)).toEqual([
            'Сначала свежие',
            'Сначала дешевле',
            'Сначала дороже',
        ]);
        expect(select).toHaveValue('');
    });

    it('выбранная сортировка в адресе отражается в списке; смена пишет sort', () => {
        render(<FleaIndex {...props({ filters: { ...EMPTY_FILTERS, sort: 'expensive' } })} />);

        const select = screen.getByLabelText('Сортировка');
        expect(select).toHaveValue('expensive');

        fireEvent.change(select, { target: { value: 'cheap' } });

        expect(lastGet()[1]).toEqual({ sort: 'cheap' });
    });

    it('«Сначала свежие» — умолчание: параметр sort из адреса убирается', () => {
        render(<FleaIndex {...props({ filters: { ...EMPTY_FILTERS, sort: 'cheap' } })} />);

        fireEvent.change(screen.getByLabelText('Сортировка'), { target: { value: '' } });

        expect(lastGet()[1]).toEqual({});
    });

    it('при поисковом запросе первая позиция — «По релевантности», а «Сначала свежие» остаётся выбором', () => {
        render(<FleaIndex {...props({ filters: { ...EMPTY_FILTERS, q: 'страт' } })} />);

        const select = screen.getByLabelText('Сортировка');
        expect(within(select).getAllByRole('option').map(text)).toEqual([
            'По релевантности',
            'Сначала свежие',
            'Сначала дешевле',
            'Сначала дороже',
        ]);

        fireEvent.change(select, { target: { value: 'new' } });
        expect(lastGet()[1]).toEqual({ q: 'страт', sort: 'new' });
    });

    it('цена по BR-11: сумма, null — «Договорная», 0 — «Бесплатно»; «0 ₽» нигде нет', () => {
        render(
            <FleaIndex
                {...props({
                    listings: [
                        card(1, { price: 184_500 }),
                        card(2, { price: null }),
                        card(3, { price: 0 }),
                    ],
                })}
            />,
        );

        const [sum, negotiable, free] = screen.getAllByRole('article') as HTMLElement[];
        expect(sum?.textContent).toContain('184 500');
        // Подпись задаёт CSS из --price-label на обёртке карточки (3.1.9), в DOM текста цены нет.
        const labelOf = (article?: HTMLElement) =>
            article?.parentElement?.style.getPropertyValue('--price-label');
        expect(labelOf(negotiable)).toBe('"Договорная"');
        expect(labelOf(free)).toBe('"Бесплатно"');
        for (const article of screen.getAllByRole('article')) {
            expect(article.textContent).not.toMatch(/(^|[^\d])0\s₽/);
        }
    });
});

describe('Flea/Index: страницы', () => {
    const more = (page: number, pages: number, total: number, shown = 24) =>
        props({
            listings: Array.from({ length: shown }, (_, i) => card(i)),
            pagination: { page, pages, total, perPage: 24 },
        });

    it('«Показать ещё» и «Показано N из M», пока есть следующая страница', () => {
        render(<FleaIndex {...more(1, 3, 60)} />);

        expect(screen.getByRole('button', { name: 'Показать ещё' })).toBeInTheDocument();
        expect(screen.getByText('Показано 24 из 60')).toBeInTheDocument();
    });

    it('на последней странице «Показать ещё» нет', () => {
        render(<FleaIndex {...more(3, 3, 60, 12)} />);

        expect(screen.queryByRole('button', { name: 'Показать ещё' })).toBeNull();
    });

    it('«Показать ещё» запрашивает только listings и pagination следующей страницы, не прыгая и без новой записи в историю', () => {
        render(<FleaIndex {...more(1, 3, 60)} />);

        fireEvent.click(screen.getByRole('button', { name: 'Показать ещё' }));

        const [url, data, options] = lastGet();
        expect(url).toBe('/baraholka');
        expect(data).toEqual({ page: 2 });
        expect(options).toMatchObject({
            only: ['listings', 'pagination'],
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    });

    it('«Показать ещё» сохраняет фильтры в запросе', () => {
        render(
            <FleaIndex
                {...{ ...more(1, 3, 60), filters: { ...EMPTY_FILTERS, ship: true, sort: 'cheap' } }}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Показать ещё' }));

        expect(lastGet()[1]).toEqual({ ship: 1, sort: 'cheap', page: 2 });
    });

    it('номера страниц для SEO — ссылки с теми же фильтрами', () => {
        render(<FleaIndex {...{ ...more(1, 3, 60), filters: { ...EMPTY_FILTERS, ship: true } }} />);

        const nav = screen.getByRole('navigation', { name: 'Страницы' });
        expect(within(nav).getByRole('link', { name: 'Страница 2' })).toHaveAttribute(
            'href',
            '/baraholka?ship=1&page=2',
        );
        expect(within(nav).getByRole('link', { name: 'Страница 3' })).toHaveAttribute(
            'href',
            '/baraholka?ship=1&page=3',
        );
    });

    it('одна страница — нет ни «Показать ещё», ни номеров', () => {
        render(<FleaIndex {...props()} />);

        expect(screen.queryByRole('button', { name: 'Показать ещё' })).toBeNull();
        expect(screen.queryByRole('navigation', { name: 'Страницы' })).toBeNull();
    });
});

describe('Flea/Index: пусто', () => {
    it('по фильтрам ничего нет — EmptyState с кнопкой «Сбросить фильтры»', () => {
        render(
            <FleaIndex
                {...props({
                    listings: [],
                    pagination: { page: 1, pages: 0, total: 0, perPage: 24 },
                    filters: { ...EMPTY_FILTERS, ship: true, condition: ['mint'] },
                })}
            />,
        );

        expect(
            screen.getByText('По этим фильтрам лотов нет. Уберите часть фильтров.'),
        ).toBeInTheDocument();
        expect(screen.queryAllByRole('article')).toHaveLength(0);

        fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
        expect(lastGet()[1]).toEqual({});
    });

    it('в городе вообще нет объявлений — без кнопки сброса', () => {
        render(
            <FleaIndex
                {...props({
                    listings: [],
                    pagination: { page: 1, pages: 0, total: 0, perPage: 24 },
                })}
            />,
        );

        expect(screen.getByText('В вашем городе пока нет объявлений.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Сбросить фильтры' })).toBeNull();
    });
});
