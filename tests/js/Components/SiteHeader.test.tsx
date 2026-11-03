import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SiteHeader from '@/Components/SiteHeader';

let flags: Record<string, boolean> = {};

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: { flags } }),
}));

const ALL_ON = {
    catalog_new: true,
    accessories: true,
    masters: true,
    sale_prices: true,
    safe_deal: true,
};

const sections = () => screen.getByRole('navigation', { name: 'Разделы' });
const sectionNames = () =>
    within(sections())
        .getAllByRole('link')
        .map((link) => link.textContent);

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
        expect(current.map((link) => link.textContent)).toEqual(['Аксессуары']);
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
        render(<SiteHeader city="Казань" />);

        expect(screen.getByRole('link', { name: 'Продать инструмент' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Казань' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/гир/i);
    });

    it('город по умолчанию — «Москва»', () => {
        render(<SiteHeader />);

        expect(screen.getByRole('button', { name: 'Москва' })).toBeInTheDocument();
    });

    it('кнопки города и входа вызывают переданные обработчики (окна — задачи 1.1.2 и 1.1.4)', () => {
        const onCity = vi.fn();
        const onLogin = vi.fn();
        render(<SiteHeader onCityClick={onCity} onLoginClick={onLogin} />);

        fireEvent.click(screen.getByRole('button', { name: 'Москва' }));
        fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

        expect(onCity).toHaveBeenCalledTimes(1);
        expect(onLogin).toHaveBeenCalledTimes(1);
    });

    it('иконки сообщений, избранного и уведомлений; у сообщений счётчик', () => {
        render(<SiteHeader messages={3} />);

        expect(screen.getByRole('link', { name: 'Сообщения, 3' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Избранное' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Уведомления' })).toBeInTheDocument();
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

describe('SiteHeader: меню категорий', () => {
    const toggle = () => screen.getByRole('button', { name: 'Категории' });

    it('закрыто по умолчанию: aria-expanded="false", окна нет', () => {
        render(<SiteHeader />);

        expect(toggle()).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('кнопка «Категории» открывает меню и связана с ним через aria-controls', () => {
        render(<SiteHeader />);

        fireEvent.click(toggle());

        const menu = screen.getByRole('dialog', { name: 'Все категории' });
        expect(toggle()).toHaveAttribute('aria-expanded', 'true');
        expect(toggle().getAttribute('aria-controls')).toBe(menu.id);
    });

    it('повторное нажатие закрывает меню', () => {
        render(<SiteHeader />);

        fireEvent.click(toggle());
        fireEvent.click(toggle());

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('Esc закрывает меню и возвращает фокус на кнопку', () => {
        render(<SiteHeader />);
        fireEvent.click(toggle());

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(toggle()).toHaveFocus();
        expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    });

    it('клик вне меню закрывает его, клик внутри нет', () => {
        render(<SiteHeader />);
        fireEvent.click(toggle());
        const menu = screen.getByRole('dialog', { name: 'Все категории' });

        fireEvent.pointerDown(menu);
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        fireEvent.pointerDown(document.body);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('Esc при закрытом меню ничего не меняет и не забирает фокус', () => {
        render(<SiteHeader />);
        screen.getByRole('searchbox').focus();

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(screen.getByRole('searchbox')).toHaveFocus();
    });

    it('виды инструментов — в порядке макета, первый выбран', () => {
        render(<SiteHeader />);
        fireEvent.click(toggle());

        const list = within(screen.getByRole('navigation', { name: 'Категории' }));
        const names = list.getAllByRole('button').map((button) => button.textContent);

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
        const menu = within(screen.getByRole('dialog'));

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
        const menu = within(screen.getByRole('dialog'));

        expect(menu.queryByRole('button', { name: 'Аксессуары и запчасти' })).toBeNull();
        expect(menu.queryByRole('button', { name: 'Мастера и ремонт' })).toBeNull();
    });

    it('при включённых флагах виды вне MVP появляются', () => {
        flags = ALL_ON;
        render(<SiteHeader />);
        fireEvent.click(toggle());
        const menu = within(screen.getByRole('dialog'));

        expect(menu.getByRole('button', { name: 'Аксессуары и запчасти' })).toBeInTheDocument();
        expect(menu.getByRole('button', { name: 'Мастера и ремонт' })).toBeInTheDocument();
    });

    it('блок «Сервисы»: без флагов только доставка и «Продать …»', () => {
        render(<SiteHeader />);
        fireEvent.click(toggle());

        const aside = within(screen.getByRole('complementary', { name: 'Сервисы' }));
        const items = aside.getAllByRole('link').map((link) => link.textContent);

        expect(items).toEqual(['Доставка в защитной упаковке', 'Продать гитары']);
    });

    it('блок «Сервисы»: с флагами masters, sale_prices, safe_deal — все пять пунктов', () => {
        flags = ALL_ON;
        render(<SiteHeader />);
        fireEvent.click(toggle());

        const aside = within(screen.getByRole('complementary', { name: 'Сервисы' }));

        expect(aside.getAllByRole('link').map((link) => link.textContent)).toEqual([
            'Проверка мастером перед покупкой',
            'Цены продаж: гитары',
            'Как работает безопасная сделка',
            'Доставка в защитной упаковке',
            'Продать гитары',
        ]);
    });
});
