import { fireEvent, render, screen, within } from '@testing-library/react';
import type { AnchorHTMLAttributes, ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Home from '@/Pages/Home';

const { visit, openLogin, auth } = vi.hoisted(() => ({
    visit: vi.fn(),
    openLogin: vi.fn(),
    auth: { user: null as null | { id: number; name: string } },
}));

vi.mock('@inertiajs/react', () => ({
    router: { visit, get: vi.fn(), on: vi.fn(() => () => undefined) },
    usePage: () => ({
        props: { flags: {}, city: { id: 1, name: 'Москва' }, auth: { user: auth.user } },
        url: '/',
    }),
    Head: () => null,
    Link: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

vi.mock('@/Hooks/loginDialog', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/Hooks/loginDialog')>()),
    openLogin,
}));

type Props = ComponentProps<typeof Home>;
type Card = Props['rails']['fresh'][number];

const card = (n: number, extra: Partial<Card> = {}): Card => ({
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

const ROOTS = [
    ['Гитары', 'gitary', 'guitar'],
    ['Педали и усилители', 'pedali-i-usiliteli', 'cable'],
    ['Клавишные и синтезаторы', 'klavishnye-i-sintezatory', 'piano'],
    ['Студия и запись', 'studiya-i-zapis', 'mic'],
    ['Ударные', 'udarnye', 'drum'],
    ['Духовые', 'duhovye', 'mic'],
    ['Смычковые', 'smychkovye', 'guitar'],
    ['DJ-оборудование', 'dj-oborudovanie', 'headphones'],
] as const;

const CATEGORIES: Props['categories'] = ROOTS.map(([name, slug, icon], index) => ({
    id: index + 1,
    name,
    slug,
    icon,
    children: [],
}));

function props(overrides: Partial<Props> = {}): Props {
    return {
        rails: { fresh: [card(1), card(2), card(3)], negotiable: [card(4)] },
        cityLabel: 'г. Москва',
        categories: CATEGORIES,
        ...overrides,
    };
}

beforeEach(() => {
    visit.mockClear();
    openLogin.mockClear();
    auth.user = null;
});

describe('Home', () => {
    it('заголовок первого уровня называет ЯМузыкант и город сайта по смыслу', () => {
        render(<Home {...props()} />);

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'ЯМузыкант: б/у музыкальные инструменты вашего города',
            }),
        ).toBeInTheDocument();
    });

    it('категории: 8 ссылок на выдачу Барахолки по слагу', () => {
        render(<Home {...props()} />);

        const nav = screen.getByRole('navigation', { name: 'Виды инструментов' });
        const links = within(nav).getAllByRole('link');
        expect(links).toHaveLength(8);
        expect(links[0]).toHaveAttribute('href', '/baraholka/gitary');
        expect(links[0]).toHaveTextContent('Гитары');
        expect(links[7]).toHaveAttribute('href', '/baraholka/dj-oborudovanie');
    });

    it('категорий больше 8 — показываются первые 8', () => {
        const extra = Array.from({ length: 3 }, (_, i) => ({
            id: 100 + i,
            name: `Лишняя ${i}`,
            slug: `lishnyaya-${i}`,
            icon: null,
            children: [],
        }));
        render(<Home {...props({ categories: [...CATEGORIES, ...extra] })} />);

        const nav = screen.getByRole('navigation', { name: 'Виды инструментов' });
        expect(within(nav).getAllByRole('link')).toHaveLength(8);
        expect(screen.queryByText('Лишняя 0')).toBeNull();
    });

    it('рельс «Новые в г. Москва»: заголовок без склонения, карточки со ссылками на лот, «Вся Барахолка»', () => {
        render(<Home {...props()} />);

        const rail = screen.getByRole('region', { name: 'Новые в г. Москва' });
        expect(
            within(rail).getByRole('heading', { level: 2, name: 'Новые в г. Москва' }),
        ).toBeInTheDocument();
        expect(within(rail).getAllByRole('article')).toHaveLength(3);
        expect(within(rail).getByRole('link', { name: 'Вся Барахолка' })).toHaveAttribute(
            'href',
            '/baraholka',
        );
        expect(within(rail).getByRole('link', { name: /Гитара 1/ })).toHaveAttribute(
            'href',
            '/listings/id-1',
        );
    });

    it('рельс «Готовы к торгу» ведёт в выдачу с фильтром торга', () => {
        render(<Home {...props()} />);

        const rail = screen.getByRole('region', { name: 'Готовы к торгу' });
        expect(within(rail).getAllByRole('article')).toHaveLength(1);
        expect(within(rail).getByRole('link', { name: 'Все готовые к торгу' })).toHaveAttribute(
            'href',
            '/baraholka?negotiable=1',
        );
    });

    it('«Готовы к торгу» пуст — рельса нет, «Новые» остаются', () => {
        render(<Home {...props({ rails: { fresh: [card(1)], negotiable: [] } })} />);

        expect(screen.queryByRole('region', { name: 'Готовы к торгу' })).toBeNull();
        expect(screen.getByRole('region', { name: 'Новые в г. Москва' })).toBeInTheDocument();
    });

    it('цена по BR-11: «Договорная» и «Бесплатно», без «0 ₽»', () => {
        render(
            <Home
                {...props({
                    rails: {
                        fresh: [card(1, { price: null }), card(2, { price: 0 })],
                        negotiable: [],
                    },
                })}
            />,
        );

        expect(screen.getByText('Договорная')).toBeInTheDocument();
        expect(screen.getByText('Бесплатно')).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/0\s*₽/);
    });

    it('пустой город: рельсы заменены сообщением с действием, заголовков рельсов нет', () => {
        render(<Home {...props({ rails: { fresh: [], negotiable: [] } })} />);

        expect(screen.queryByRole('region', { name: 'Новые в г. Москва' })).toBeNull();
        expect(screen.queryByRole('region', { name: 'Готовы к торгу' })).toBeNull();
        expect(screen.getByText('В г. Москва пока нет объявлений.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Выбрать другой город' })).toBeInTheDocument();
    });

    it('блок «Продать инструмент»: вошедшему — ссылка на форму', () => {
        auth.user = { id: 1, name: 'Анна' };
        render(<Home {...props()} />);

        const block = screen.getByRole('region', { name: 'Продать инструмент' });
        expect(within(block).getByRole('link', { name: 'Продать инструмент' })).toHaveAttribute(
            'href',
            '/sell',
        );
    });

    it('блок «Продать инструмент»: гость сначала входит, затем попадает на форму', () => {
        render(<Home {...props()} />);

        const block = screen.getByRole('region', { name: 'Продать инструмент' });
        fireEvent.click(within(block).getByRole('link', { name: 'Продать инструмент' }));

        expect(openLogin).toHaveBeenCalledTimes(1);
        const request = openLogin.mock.calls[0]?.[0] as { onAuthenticated: () => void };
        request.onAuthenticated();
        expect(visit).toHaveBeenCalledWith('/sell');
    });

    it('TrustStrip: тексты из словаря, без запрещённых слов и обещаний вне MVP', () => {
        render(<Home {...props()} />);

        const strip = screen.getByRole('region', { name: 'Гарантии ЯМузыканта' });
        expect(strip.textContent).not.toMatch(/Фермата|Безопасная сделка|Кофр|мастер|доставк/i);
        expect(within(strip).getAllByRole('heading', { level: 2 })).toHaveLength(1);
    });

    it('блоки вне MVP не выводятся: мастера, проверено мастером, цены продаж, подборки', () => {
        render(<Home {...props()} />);

        for (const text of [
            'Проверка мастером',
            'Проверено мастером',
            'Мастера рядом',
            'Недавно продано',
            'Безопасная сделка',
            'Рядом с вами',
        ]) {
            expect(screen.queryByText(text)).toBeNull();
        }
    });
});

describe('Home: SSR', () => {
    it('на сервере рендерит категории, рельсы и карточки без браузерных API', async () => {
        const { renderToString } = await import('react-dom/server');
        const html = renderToString(<Home {...props()} />);

        expect(html).toContain('Новые в г. Москва');
        expect(html).toContain('href="/baraholka/gitary"');
        expect(html).toContain('href="/listings/id-1"');
        expect(html).toContain('Гитара 1');
    });
});
