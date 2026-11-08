import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SiteHeader from '@/Components/SiteHeader';

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
    delivery_service: true,
};

/** Меню категорий в DOM (id из CategoryMenu): открыто — элемент есть, закрыто — нет. */
const menuEl = (): HTMLElement | null => document.getElementById('site-category-menu');

/** Подменяет matchMedia: `narrow` — экран < 640 px (шторка), иначе выпадающая панель. */
const mockViewport = (narrow: boolean) => {
    window.matchMedia = ((query: string) => ({
        matches: narrow && query === '(max-width: 639px)',
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
};

const sections = () => screen.getByRole('navigation', { name: 'Разделы' });
const sectionNames = () => within(sections()).getAllByRole('link').map(text);

beforeEach(() => {
    flags = {};
});

describe('SiteHeader: строка разделов и флаги', () => {
    it('все флаги выключены: в строке разделов только «Барахолка»', () => {
        render(<SiteHeader />);

        expect(sectionNames()).toEqual(['Барахолка']);
    });

    it('все флаги включены: пять разделов в порядке макета', () => {
        flags = ALL_ON;
        render(<SiteHeader />);

        expect(sectionNames()).toEqual([
            'Каталог',
            'Барахолка',
            'Аксессуары',
            'Мастера',
            'Цены продаж',
        ]);
    });

    it.each([
        ['catalog_new', 'Каталог'],
        ['accessories', 'Аксессуары'],
        ['masters', 'Мастера'],
        ['sale_prices', 'Цены продаж'],
    ])('флаг %s включает только раздел «%s»', (flag, label) => {
        flags = { [flag]: true };
        render(<SiteHeader />);

        expect(sectionNames()).toContain(label);
        expect(sectionNames()).toHaveLength(2);
    });

    it('активный раздел помечен aria-current="page", остальные нет', () => {
        flags = ALL_ON;
        render(<SiteHeader active="parts" />);

        const current = within(sections())
            .getAllByRole('link')
            .filter((link) => link.getAttribute('aria-current') === 'page');
        expect(current.map(text)).toEqual(['Аксессуары']);
    });

    it('active="none": ни один раздел не помечен', () => {
        flags = ALL_ON;
        render(<SiteHeader active="none" />);

        expect(sections().querySelector('[aria-current]')).toBeNull();
    });

    it('раздел, скрытый флагом, не рендерится, даже если он active', () => {
        render(<SiteHeader active="masters" />);

        expect(sections().querySelector('[aria-current]')).toBeNull();
        expect(screen.queryByText('Мастера')).not.toBeInTheDocument();
    });
});

describe('SiteHeader: состав шапки', () => {
    it('поиск показан по умолчанию и скрыт при search={false}', () => {
        const { unmount } = render(<SiteHeader />);
        expect(screen.getByRole('search')).toBeInTheDocument();
        unmount();

        render(<SiteHeader search={false} />);
        expect(screen.queryByRole('search')).not.toBeInTheDocument();
    });

    it('подсказка поиска без «мастера» при выключенном флаге masters', () => {
        const { unmount } = render(<SiteHeader />);
        expect(screen.getByRole('searchbox')).toHaveAttribute(
            'placeholder',
            'Гитары, педали, синтезаторы',
        );
        unmount();

        flags = { masters: true };
        render(<SiteHeader />);
        expect(screen.getByRole('searchbox')).toHaveAttribute(
            'placeholder',
            'Гитары, педали, синтезаторы, мастера',
        );
    });

    it('кнопки «Продать инструмент», города и «Войти»; слов вне словаря нет', () => {
        render(<SiteHeader city={{ id: 2, name: 'Казань' }} />);

        expect(screen.getByRole('link', { name: 'Продать инструмент' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Казань' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/гир/i);
    });

    it('город по умолчанию — «Москва»', () => {
        render(<SiteHeader />);

        expect(screen.getByRole('button', { name: 'Москва' })).toBeInTheDocument();
    });

    it('кнопка города открывает выбор города (1.1.4); кнопка входа вызывает обработчик (окно — 1.1.2)', () => {
        const onLogin = vi.fn();
        render(<SiteHeader onLoginClick={onLogin} />);

        fireEvent.click(screen.getByRole('button', { name: 'Москва' }));
        expect(screen.getByRole('button', { name: 'Москва' })).toHaveAttribute(
            'aria-expanded',
            'true',
        );
        fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

        expect(onLogin).toHaveBeenCalledTimes(1);
    });

    it('иконки сообщений, избранного и уведомлений; у сообщений счётчик', () => {
        render(<SiteHeader messages={3} />);

        expect(screen.getByRole('link', { name: 'Сообщения, 3' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Избранное' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Уведомления' })).toBeInTheDocument();
    });

    it('иконка сообщений ведёт на экран сообщений (4.1.2)', () => {
        render(<SiteHeader messages={3} />);

        expect(screen.getByRole('link', { name: 'Сообщения, 3' })).toHaveAttribute(
            'href',
            '/messages',
        );
    });

    it('без непрочитанных сообщений счётчика нет', () => {
        render(<SiteHeader messages={0} />);

        expect(screen.getByRole('link', { name: 'Сообщения' })).toBeInTheDocument();
    });

    it('«ЯМузыкант» — ссылка на главную', () => {
        render(<SiteHeader />);

        expect(screen.getByRole('link', { name: 'ЯМузыкант' })).toHaveAttribute('href', '/');
    });

    it('отправка поиска передаёт запрос в onSearch', () => {
        const onSearch = vi.fn();
        render(<SiteHeader onSearch={onSearch} />);

        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Stratocaster' } });
        fireEvent.submit(screen.getByRole('search'));

        expect(onSearch).toHaveBeenCalledWith('Stratocaster');
    });
});

describe('SiteHeader: меню категорий (выпадающая панель, >= 640 px)', () => {
    const toggle = () => screen.getByRole('button', { name: 'Категории' });

    it('закрыто по умолчанию: aria-expanded="false", меню не отрисовано', () => {
        render(<SiteHeader />);

        expect(toggle()).toHaveAttribute('aria-expanded', 'false');
        expect(menuEl()).toBeNull();
    });

    it('кнопка «Категории» раскрывает панель, связана с ней через aria-controls; роли dialog нет', () => {
        render(<SiteHeader />);

        fireEvent.click(toggle());

        const menu = menuEl();
        expect(menu).not.toBeNull();
        expect(toggle()).toHaveAttribute('aria-expanded', 'true');
        expect(toggle().getAttribute('aria-controls')).toBe(menu?.id);
        expect(menu).not.toHaveAttribute('role');
        expect(menu).not.toHaveAttribute('aria-modal');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('повторное нажатие закрывает меню', () => {
        render(<SiteHeader />);

        fireEvent.click(toggle());
        fireEvent.click(toggle());

        expect(menuEl()).toBeNull();
    });

    it('Esc закрывает меню и возвращает фокус на кнопку', () => {
        render(<SiteHeader />);
        fireEvent.click(toggle());

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(menuEl()).toBeNull();
        expect(toggle()).toHaveFocus();
        expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    });

    it('клик вне меню закрывает его, клик внутри нет', () => {
        render(<SiteHeader />);
        fireEvent.click(toggle());
        const menu = menuEl() as HTMLElement;

        fireEvent.pointerDown(menu);
        expect(menuEl()).not.toBeNull();

        fireEvent.pointerDown(document.body);
        expect(menuEl()).toBeNull();
    });

    it('фокус ушёл из меню на поле поиска (за пределами меню, но в шапке) — меню закрывается', () => {
        render(<SiteHeader />);
        fireEvent.click(toggle());

        act(() => screen.getByRole('searchbox').focus());

        expect(menuEl()).toBeNull();
        expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    });

    it('фокус внутри меню (вид инструментов) меню не закрывает', () => {
        render(<SiteHeader />);
        fireEvent.click(toggle());

        act(() =>
            within(menuEl() as HTMLElement)
                .getByRole('button', { name: 'Ударные' })
                .focus(),
        );

        expect(menuEl()).not.toBeNull();
    });

    it('в меню нет заголовков: иерархия страницы не сдвигается (h2 раньше h1)', () => {
        render(<SiteHeader />);
        fireEvent.click(toggle());

        expect(menuEl()?.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(0);
    });

    it('виды инструментов — в порядке макета, первый выбран', () => {
        render(<SiteHeader />);
        fireEvent.click(toggle());

        const list = within(screen.getByRole('navigation', { name: 'Категории' }));
        const names = list.getAllByRole('button').map(text);

        expect(names).toEqual([
            'Гитары',
            'Педали и усилители',
            'Клавишные и синтезаторы',
            'Студия и запись',
            'Ударные',
            'Духовые',
            'Смычковые',
            'DJ-оборудование',
        ]);
        expect(list.getByRole('button', { name: 'Гитары' })).toHaveAttribute(
            'aria-current',
            'true',
        );
    });

    it('наведение и фокус на виде переключают правую панель', () => {
        render(<SiteHeader />);
        fireEvent.click(toggle());
        const menu = within(menuEl() as HTMLElement);

        expect(menu.getByRole('link', { name: /Электрогитары/ })).toBeInTheDocument();

        fireEvent.focus(menu.getByRole('button', { name: 'Ударные' }));

        expect(menu.getByRole('link', { name: /Акустические установки/ })).toBeInTheDocument();
        expect(menu.queryByRole('link', { name: /Электрогитары/ })).not.toBeInTheDocument();
        expect(menu.getByRole('button', { name: 'Ударные' })).toHaveAttribute(
            'aria-current',
            'true',
        );
    });

    it('виды вне MVP («Аксессуары и запчасти», «Мастера и ремонт») скрыты флагами', () => {
        render(<SiteHeader />);
        fireEvent.click(toggle());
        const menu = within(menuEl() as HTMLElement);

        expect(menu.queryByRole('button', { name: 'Аксессуары и запчасти' })).toBeNull();
        expect(menu.queryByRole('button', { name: 'Мастера и ремонт' })).toBeNull();
    });

    it('при включённых флагах виды вне MVP появляются', () => {
        flags = ALL_ON;
        render(<SiteHeader />);
        fireEvent.click(toggle());
        const menu = within(menuEl() as HTMLElement);

        expect(menu.getByRole('button', { name: 'Аксессуары и запчасти' })).toBeInTheDocument();
        expect(menu.getByRole('button', { name: 'Мастера и ремонт' })).toBeInTheDocument();
    });

    it('блок «Сервисы» назван подписью, не заголовком страницы', () => {
        render(<SiteHeader />);
        fireEvent.click(toggle());

        expect(screen.getByRole('complementary', { name: 'Сервисы' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Сервисы' })).toBeNull();
    });

    it('блок «Сервисы»: без флагов только «Продать …» — доставка скрыта флагом delivery_service', () => {
        render(<SiteHeader />);
        fireEvent.click(toggle());

        const aside = within(screen.getByRole('complementary', { name: 'Сервисы' }));

        expect(aside.getAllByRole('link').map(text)).toEqual(['Продать гитары']);
    });

    it('блок «Сервисы»: с флагами masters, sale_prices, safe_deal, delivery_service — все пять пунктов', () => {
        flags = ALL_ON;
        render(<SiteHeader />);
        fireEvent.click(toggle());

        const aside = within(screen.getByRole('complementary', { name: 'Сервисы' }));

        expect(aside.getAllByRole('link').map(text)).toEqual([
            'Проверка мастером перед покупкой',
            'Цены продаж: гитары',
            'Как работает безопасная сделка',
            'Доставка в защитной упаковке',
            'Продать гитары',
        ]);
    });

    it('delivery_service включён: пункт «Доставка в защитной упаковке» один, без других флагов', () => {
        flags = { delivery_service: true };
        render(<SiteHeader />);
        fireEvent.click(toggle());

        const aside = within(screen.getByRole('complementary', { name: 'Сервисы' }));

        expect(aside.getAllByRole('link').map(text)).toEqual([
            'Доставка в защитной упаковке',
            'Продать гитары',
        ]);
    });
});

describe('SiteHeader: меню категорий — шторка на < 640 px (модальный диалог)', () => {
    beforeEach(() => mockViewport(true));
    afterEach(() => {
        delete (window as { matchMedia?: unknown }).matchMedia;
    });

    const toggle = () => screen.getByRole('button', { name: 'Категории' });
    const open = () => {
        fireEvent.click(toggle());
        return screen.getByRole('dialog', { name: 'Все категории' });
    };

    it('шторка — модальный диалог: role="dialog", aria-modal="true", aria-controls кнопки указывает на неё', () => {
        render(<SiteHeader />);

        const sheet = open();
        expect(sheet).toHaveAttribute('aria-modal', 'true');
        expect(toggle().getAttribute('aria-controls')).toBe(sheet.id);
    });

    it('сначала виден список видов инструментов', () => {
        render(<SiteHeader />);

        expect(open()).toHaveAttribute('data-view', 'list');
    });

    it('при открытии фокус переносится в шторку (на выбранный вид), а не остаётся на «Категории»', () => {
        render(<SiteHeader />);
        open();

        expect(screen.getByRole('button', { name: 'Гитары' })).toHaveFocus();
    });

    it('фокус, уведённый из шторки (поле поиска под ней), возвращается внутрь', () => {
        render(<SiteHeader />);
        const sheet = open();

        act(() => screen.getByRole('searchbox').focus());

        expect(sheet).toBeInTheDocument();
        expect(sheet.contains(document.activeElement)).toBe(true);
    });

    it('выбор вида переводит шторку к его группам, «Все категории» возвращает к списку', () => {
        render(<SiteHeader />);
        const sheet = open();

        fireEvent.click(within(sheet).getByRole('button', { name: 'Ударные' }));
        expect(sheet).toHaveAttribute('data-view', 'panel');

        fireEvent.click(within(sheet).getByRole('button', { name: 'Все категории' }));
        expect(sheet).toHaveAttribute('data-view', 'list');
    });

    it('переключение видов не теряет фокус: «виды → группы» ставит фокус на «Все категории», «назад» — на вид', () => {
        render(<SiteHeader />);
        const sheet = open();

        fireEvent.click(within(sheet).getByRole('button', { name: 'Ударные' }));
        expect(within(sheet).getByRole('button', { name: 'Все категории' })).toHaveFocus();

        fireEvent.click(within(sheet).getByRole('button', { name: 'Все категории' }));
        expect(within(sheet).getByRole('button', { name: 'Ударные' })).toHaveFocus();
    });

    it('кнопка «Закрыть меню» закрывает шторку и возвращает фокус на «Категории»', () => {
        render(<SiteHeader />);
        const sheet = open();

        fireEvent.click(within(sheet).getByRole('button', { name: 'Закрыть меню' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(toggle()).toHaveFocus();
        expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    });

    it('после закрытия шторка открывается снова со списком', () => {
        render(<SiteHeader />);
        fireEvent.click(within(open()).getByRole('button', { name: 'Ударные' }));

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(open()).toHaveAttribute('data-view', 'list');
    });

    it('подпись кнопки «Категории» в отдельном элементе: на телефоне остаётся иконка, имя сохраняется', () => {
        render(<SiteHeader />);

        expect(toggle().querySelector('.ym-site-header__cats-label')).not.toBeNull();
    });
});
