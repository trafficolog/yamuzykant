import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LotShow, { type LotShowProps } from '@/Pages/Lot/Show';

// 3.1.5: страница объявления. Цена по BR-11, почты продавца нет (BR-04), «Предложить цену» не выводится до 4.2.2,
// «Написать» у гостя открывает вход, у вошедшего — поле сообщения (POST /listings/{id}/conversations, 4.1.1).

vi.mock('@inertiajs/react', () => ({
    Link: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
    Head: ({ children }: { children?: ReactNode }) => <>{children}</>,
    usePage: () => ({ props: {} }),
}));

const openLogin = vi.fn();
vi.mock('@/Hooks/loginDialog', () => ({ openLogin: (input: unknown) => openLogin(input) }));

const postJson = vi.fn();
vi.mock('@/lib/postJson', () => ({
    postJson: (url: string, data: Record<string, unknown>) => postJson(url, data),
}));

const urls = (id: number) => ({
    wide: { webp: `/media/photos/${id}/wide.webp`, avif: `/media/photos/${id}/wide.avif` },
    square: { webp: `/media/photos/${id}/square.webp`, avif: `/media/photos/${id}/square.avif` },
});

const base: LotShowProps = {
    listing: {
        id: 'lot-1',
        title: 'Fender American Vintage ’57 Stratocaster 2009, Sunburst',
        price: 184_500,
        negotiable: true,
        condition: { value: 'excellent', label: 'Отличное' },
        year: 2009,
        brand: 'Fender',
        model: 'American Vintage ’57 Stratocaster',
        serial: 'V09****',
        description: 'Гриф шлифовали один раз.',
        city: { type: 'г.', name: 'Москва' },
        meet: true,
        ship: true,
        posted: '3 дня назад',
        status: 'published',
        sold: false,
    },
    crumbs: [
        { name: 'Гитары', path: 'gitary' },
        { name: 'Электрогитары', path: 'gitary/elektrogitary' },
    ],
    photos: [
        { id: 1, is_serial: false, urls: urls(1) },
        { id: 2, is_serial: false, urls: urls(2) },
        { id: 3, is_serial: true, urls: urls(3) },
    ],
    seller: { id: 7, name: 'Гитарный угол', city: 'Москва', since: 2025 },
    viewer: { authenticated: false, is_owner: false },
    similar: [
        {
            id: 's1',
            title: 'Fender Player Stratocaster 2019',
            price: 78_000,
            condition: 'good',
            city: 'Москва',
            ship: false,
            negotiable: false,
            posted: 'вчера',
            image: null,
        },
        {
            id: 's2',
            title: 'Гитара в подарок',
            price: 0,
            condition: 'fair',
            city: 'Москва',
            ship: false,
            negotiable: false,
            posted: '2 дня назад',
            image: null,
        },
    ],
};

const withListing = (patch: Partial<LotShowProps['listing']>): LotShowProps => ({
    ...base,
    listing: { ...base.listing, ...patch },
});

beforeEach(() => {
    openLogin.mockReset();
    postJson.mockReset();
});

describe('Lot/Show: заголовок и цена (BR-11)', () => {
    it('заголовок h1, состояние и сумма с ₽', () => {
        render(<LotShow {...base} />);

        expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
            'Stratocaster 2009',
        );
        expect(screen.getAllByText(/Отличное/).length).toBeGreaterThan(0);
        expect(document.querySelector('.ym-price--pdp')?.textContent).toMatch(/184\s500\s₽/);
    });

    it('«Готов к торгу» — только при сумме', () => {
        const { unmount } = render(<LotShow {...base} />);
        expect(screen.getByText('Готов к торгу')).toBeInTheDocument();
        unmount();

        render(<LotShow {...withListing({ price: 184_500, negotiable: false })} />);
        expect(screen.queryByText('Готов к торгу')).toBeNull();
    });

    it('price = null — «Договорная», «0 ₽» и «Готов к торгу» нет', () => {
        render(<LotShow {...withListing({ price: null, negotiable: false })} />);

        expect(screen.getAllByText('Договорная').length).toBeGreaterThan(0);
        expect(document.querySelector('.ym-price--pdp')?.textContent).not.toContain('₽');
        expect(screen.queryByText('Готов к торгу')).toBeNull();
    });

    it('price = 0 — «Бесплатно», «0 ₽» нигде нет, в том числе в похожих', () => {
        render(<LotShow {...withListing({ price: 0, negotiable: false })} />);

        expect(document.querySelector('.ym-price--pdp')?.textContent).toBe('Бесплатно');
        expect(document.body.textContent).not.toMatch(/(^|\D)0\s₽/);
        expect(screen.getAllByText('Бесплатно').length).toBeGreaterThanOrEqual(2);
    });
});

describe('Lot/Show: кнопки действий', () => {
    it('«Предложить цену» не выводится (до 4.2.2, G2)', () => {
        render(<LotShow {...base} />);

        expect(screen.queryByText('Предложить цену')).toBeNull();
    });

    it('гость: «Написать продавцу» открывает вход', () => {
        render(<LotShow {...base} />);

        fireEvent.click(screen.getByRole('button', { name: 'Написать продавцу' }));

        expect(openLogin).toHaveBeenCalledTimes(1);
        expect(postJson).not.toHaveBeenCalled();
    });

    it('вошедший: появляется поле сообщения, отправка — POST по объявлению', async () => {
        postJson.mockResolvedValue({ status: 201, body: { conversation: { id: 7 } } });
        render(<LotShow {...base} viewer={{ authenticated: true, is_owner: false }} />);

        fireEvent.click(screen.getByRole('button', { name: 'Написать продавцу' }));
        expect(openLogin).not.toHaveBeenCalled();
        fireEvent.change(screen.getByRole('textbox', { name: /Сообщение/ }), {
            target: { value: 'Здравствуйте, гитара ещё продаётся?' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

        await waitFor(() =>
            expect(postJson).toHaveBeenCalledWith('/listings/lot-1/conversations', {
                body: 'Здравствуйте, гитара ещё продаётся?',
            }),
        );
        expect(await screen.findByText(/Сообщение отправлено/)).toBeInTheDocument();
    });

    it('пустое сообщение не отправляется', () => {
        render(<LotShow {...base} viewer={{ authenticated: true, is_owner: false }} />);

        fireEvent.click(screen.getByRole('button', { name: 'Написать продавцу' }));

        expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled();
    });

    it('ошибка сервера показывается и не теряет текст', async () => {
        postJson.mockResolvedValue({ status: 429, body: {} });
        render(<LotShow {...base} viewer={{ authenticated: true, is_owner: false }} />);

        fireEvent.click(screen.getByRole('button', { name: 'Написать продавцу' }));
        fireEvent.change(screen.getByRole('textbox', { name: /Сообщение/ }), {
            target: { value: 'Привет' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /Сообщение/ })).toHaveValue('Привет');
    });

    it('своё объявление: вместо «Написать» — пометка владельца', () => {
        render(<LotShow {...base} viewer={{ authenticated: true, is_owner: true }} />);

        expect(screen.queryByRole('button', { name: 'Написать продавцу' })).toBeNull();
        expect(screen.getByText('Это ваше объявление')).toBeInTheDocument();
    });
});

describe('Lot/Show: плашки статуса (видны только владельцу и сотрудникам)', () => {
    it('опубликованное — без плашки', () => {
        render(<LotShow {...base} />);

        expect(screen.queryByTestId('lot-status')).toBeNull();
    });

    it.each([
        [{ status: 'withdrawn' as const, sold: true }, 'Продано'],
        [{ status: 'withdrawn' as const, sold: false }, 'Снято с продажи'],
        [{ status: 'pending' as const, sold: false }, 'На проверке'],
        [{ status: 'needs_changes' as const, sold: false }, 'Требует доработки'],
        [{ status: 'expired' as const, sold: false }, 'Срок публикации истёк'],
    ])('%j — «%s», кнопки «Написать» нет', (patch, label) => {
        render(
            <LotShow {...withListing(patch)} viewer={{ authenticated: true, is_owner: true }} />,
        );

        expect(screen.getByTestId('lot-status')).toHaveTextContent(label);
        expect(screen.queryByRole('button', { name: 'Написать продавцу' })).toBeNull();
    });

    it('сотрудник (не владелец) видит плашку, но не «Это ваше объявление»', () => {
        render(
            <LotShow
                {...withListing({ status: 'pending' })}
                viewer={{ authenticated: true, is_owner: false }}
            />,
        );

        expect(screen.getByTestId('lot-status')).toHaveTextContent('На проверке');
        expect(screen.queryByText('Это ваше объявление')).toBeNull();
    });
});

describe('Lot/Show: характеристики, продавец, получение', () => {
    it('характеристики: бренд, модель, год, маска серийного номера', () => {
        render(<LotShow {...base} />);

        const specs = screen.getByRole('heading', { name: 'Характеристики' })
            .parentElement as HTMLElement;
        expect(within(specs).getByText('Fender')).toBeInTheDocument();
        expect(within(specs).getByText('2009')).toBeInTheDocument();
        expect(within(specs).getByText('V09****')).toBeInTheDocument();
    });

    it('без серийного номера и года строк нет', () => {
        render(<LotShow {...withListing({ serial: null, year: null })} />);

        expect(screen.queryByText('Серийный номер')).toBeNull();
        expect(screen.queryByText('Год')).toBeNull();
    });

    it('карточка продавца: имя, город, «На ЯМузыканте с 2025», без почты', () => {
        render(<LotShow {...base} />);

        const seller = screen.getByRole('region', { name: 'Продавец' });
        expect(within(seller).getByText('Гитарный угол')).toBeInTheDocument();
        expect(seller.textContent).toContain('На ЯМузыканте с 2025');
        expect(seller.textContent).not.toMatch(/@/);
    });

    it('имя продавца — ссылка на его страницу (3.1.6)', () => {
        render(<LotShow {...base} />);

        const seller = screen.getByRole('region', { name: 'Продавец' });
        expect(
            within(seller).getByRole('link', { name: 'Гитарный угол' }).getAttribute('href'),
        ).toBe('/sellers/7');
    });

    it('способы передачи: доставка и встреча с городом; расстояния нет', () => {
        render(<LotShow {...base} />);

        const list = screen.getByRole('list', { name: 'Доставка и получение' });
        expect(list.textContent).toContain('Доставка');
        expect(list.textContent).toContain('Встреча в г. Москва');
        expect(document.body.textContent).not.toMatch(/\d\s?км/);
    });

    it('блоков вне MVP нет: Проверено мастером, Цены на б/у, Паспорт, Аксессуары', () => {
        render(<LotShow {...base} />);

        for (const text of [
            'Проверено мастером',
            'Цены на б/у',
            'Паспорт инструмента',
            'Аксессуары',
            'Заказать проверку',
        ]) {
            expect(screen.queryByText(new RegExp(text))).toBeNull();
        }
    });

    it('хлебные крошки ведут в Барахолку по категории, текущая — без ссылки', () => {
        render(<LotShow {...base} />);

        const nav = screen.getByRole('navigation', { name: 'Хлебные крошки' });
        const hrefs = within(nav)
            .getAllByRole('link')
            .map((a) => a.getAttribute('href'));
        expect(hrefs).toEqual([
            '/',
            '/baraholka',
            '/baraholka/gitary',
            '/baraholka/gitary/elektrogitary',
        ]);
        expect(nav.querySelector('[aria-current="page"]')?.textContent).toContain('Stratocaster');
    });
});

describe('Lot/Show: галерея', () => {
    it('счётчик «1 / 3», превью переключают фото', () => {
        render(<LotShow {...base} />);

        const gallery = screen.getByRole('region', { name: 'Фотографии' });
        expect(gallery.textContent).toContain('1 / 3');
        fireEvent.click(within(gallery).getByRole('button', { name: 'Фото 2' }));
        expect(gallery.textContent).toContain('2 / 3');
        expect(within(gallery).getByRole('button', { name: 'Фото 2' })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
    });

    it('главное фото 4:3 — picture с avif и webp, у фото есть alt', () => {
        render(<LotShow {...base} />);

        const picture = screen.getByRole('region', { name: 'Фотографии' }).querySelector('picture');
        expect(picture?.querySelector('source[type="image/avif"]')).not.toBeNull();
        expect(picture?.querySelector('img')).toHaveAttribute(
            'alt',
            expect.stringMatching(/Фото 1/),
        );
    });

    it('полноэкранный просмотр: открывается диалогом, Escape закрывает, фокус возвращается', () => {
        render(<LotShow {...base} />);

        const opener = screen.getByRole('button', { name: 'Открыть фото на весь экран' });
        opener.focus();
        fireEvent.click(opener);
        const dialog = screen.getByRole('dialog', { name: 'Просмотр фото' });
        expect(dialog).toBeInTheDocument();

        fireEvent.keyDown(dialog, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(opener).toHaveFocus();
    });

    it('в полноэкранном просмотре стрелки листают фото', () => {
        render(<LotShow {...base} />);

        fireEvent.click(screen.getByRole('button', { name: 'Открыть фото на весь экран' }));
        const dialog = screen.getByRole('dialog', { name: 'Просмотр фото' });
        fireEvent.keyDown(dialog, { key: 'ArrowRight' });

        expect(dialog.textContent).toContain('2 / 3');
    });

    it('без фото — заглушка без превью и счётчика', () => {
        render(<LotShow {...base} photos={[]} />);

        expect(screen.getByText('Фото нет')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Открыть фото на весь экран' })).toBeNull();
    });
});

describe('Lot/Show: похожие', () => {
    it('заголовок, карточки — ссылки на лоты, «Все в Барахолке»', () => {
        render(<LotShow {...base} />);

        const section = screen.getByRole('heading', { name: 'Похожие лоты рядом' }).parentElement
            ?.parentElement as HTMLElement;
        const hrefs = within(section)
            .getAllByRole('link')
            .map((a) => a.getAttribute('href'));
        expect(hrefs).toContain('/listings/s1');
        expect(hrefs).toContain('/baraholka/gitary/elektrogitary');
    });

    it('пустой список — блока нет', () => {
        render(<LotShow {...base} similar={[]} />);

        expect(screen.queryByRole('heading', { name: 'Похожие лоты рядом' })).toBeNull();
    });
});

describe('Lot/Show: SSR', () => {
    it('рендерится в строку: цена, заголовок и маска серийного номера в разметке', async () => {
        const { renderToString } = await import('react-dom/server');

        const html = renderToString(<LotShow {...base} />);

        expect(html).toContain('Stratocaster 2009');
        expect(html).toMatch(/184\s500\s₽/);
        expect(html).toContain('V09****');
    });
});
