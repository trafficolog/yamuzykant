import { Button, IconButton, SearchBar, Wordmark } from '@ds';
import { useCallback, useEffect, useRef, useState } from 'react';

import CategoryMenu, { CATEGORY_MENU_ID } from '@/Components/CategoryMenu';
import { useFlag, type FlagName } from '@/Hooks/useFlag';
import { CATEGORY_TREE, type CategoryNode } from '@/lang/categories';
import { ru } from '@/lang/ru';

/** Разделы строки над шапкой; `none` — страница не относится ни к одному разделу. */
export type HeaderSection = 'catalog' | 'flea' | 'parts' | 'masters' | 'guide';

export interface SiteHeaderProps {
    /** Активный раздел (`aria-current="page"`). */
    active?: HeaderSection | 'none';
    /** Показать строку поиска. */
    search?: boolean;
    /** Название города на кнопке; окно выбора — задача 1.1.4. */
    city?: string;
    /** Число непрочитанных сообщений; 0 — без счётчика. */
    messages?: number;
    /** Дерево категорий; до справочника 1.2.1 — константа из макета. */
    categories?: readonly CategoryNode[];
    onSearch?: (query: string) => void;
    onCityClick?: () => void;
    /** Окно входа — задача 1.1.2. */
    onLoginClick?: () => void;
}

interface Section {
    key: HeaderSection;
    label: string;
    href: string;
    flag?: FlagName;
}

/** «Барахолка» — выдача из карточки 3.1.2; остальные разделы вне MVP, их адресов ещё нет. */
const SECTIONS: readonly Section[] = [
    { key: 'catalog', label: ru.header.sections.catalog, href: '#', flag: 'catalog_new' },
    { key: 'flea', label: ru.header.sections.flea, href: '/baraholka' },
    { key: 'parts', label: ru.header.sections.parts, href: '#', flag: 'accessories' },
    { key: 'masters', label: ru.header.sections.masters, href: '#', flag: 'masters' },
    { key: 'guide', label: ru.header.sections.guide, href: '#', flag: 'sale_prices' },
];

/** Страницы кабинета и формы продажи — задачи 2.1.3, 4.1.2, 4.3.1, 4.4.2. */
const HREF_SOON = '#';

const TOGGLE_ID = 'site-category-toggle';

export default function SiteHeader({
    active = 'none',
    search = true,
    city = ru.header.defaultCity,
    messages = 0,
    categories = CATEGORY_TREE,
    onSearch,
    onCityClick,
    onLoginClick,
}: SiteHeaderProps) {
    const enabled: Partial<Record<FlagName, boolean>> = {
        catalog_new: useFlag('catalog_new'),
        accessories: useFlag('accessories'),
        masters: useFlag('masters'),
        sale_prices: useFlag('sale_prices'),
        safe_deal: useFlag('safe_deal'),
    };
    const isEnabled = (flag: FlagName | undefined): boolean =>
        flag === undefined || enabled[flag] === true;

    const [open, setOpen] = useState(false);
    const headerRef = useRef<HTMLElement>(null);

    const closeMenu = useCallback((restoreFocus: boolean) => {
        setOpen(false);
        if (restoreFocus) document.getElementById(TOGGLE_ID)?.focus();
    }, []);

    // Пока меню открыто: Esc закрывает и возвращает фокус на кнопку; клик и фокус вне меню закрывают.
    useEffect(() => {
        if (!open) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeMenu(true);
        };
        const onPointerDown = (event: Event) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            const inside =
                document.getElementById(CATEGORY_MENU_ID)?.contains(target) ||
                document.getElementById(TOGGLE_ID)?.contains(target);
            if (!inside) closeMenu(false);
        };
        const onFocusIn = (event: FocusEvent) => {
            const target = event.target;
            if (target instanceof Node && !headerRef.current?.contains(target)) closeMenu(false);
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('focusin', onFocusIn);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('focusin', onFocusIn);
        };
    }, [open, closeMenu]);

    const sections = SECTIONS.filter((section) => isEnabled(section.flag));

    return (
        <header ref={headerRef} className="ym-site-header">
            <div className="ym-site-header__strip">
                <div className="ym-site-header__strip-in">
                    <nav aria-label={ru.header.sectionsLabel} className="ym-site-header__sections">
                        {sections.map((section) => (
                            <a
                                key={section.key}
                                href={section.href}
                                className="ym-site-header__section"
                                aria-current={section.key === active ? 'page' : undefined}
                            >
                                {section.label}
                            </a>
                        ))}
                    </nav>
                    <div className="ym-site-header__tools">
                        <IconButton
                            icon="message-circle"
                            label={ru.header.messages}
                            href={HREF_SOON}
                            count={messages > 0 ? messages : undefined}
                            showLabel={false}
                        />
                        <IconButton
                            icon="heart"
                            label={ru.header.favorites}
                            href={HREF_SOON}
                            showLabel={false}
                        />
                        <IconButton
                            icon="bell"
                            label={ru.header.notifications}
                            href={HREF_SOON}
                            showLabel={false}
                        />
                    </div>
                </div>
            </div>

            <div className="ym-site-header__main">
                <div className="ym-site-header__main-in">
                    <Wordmark size={24} href="/" />

                    <div className="ym-site-header__cats">
                        <Button
                            id={TOGGLE_ID}
                            variant={open ? 'inverse' : 'muted'}
                            icon={open ? 'x' : 'layout-grid'}
                            aria-expanded={open}
                            aria-controls={CATEGORY_MENU_ID}
                            onClick={() => (open ? closeMenu(false) : setOpen(true))}
                        >
                            <span className="ym-site-header__cats-label">
                                {ru.header.categories}
                            </span>
                        </Button>
                        {open ? (
                            <CategoryMenu
                                categories={categories}
                                isEnabled={isEnabled}
                                onClose={() => closeMenu(true)}
                            />
                        ) : null}
                    </div>

                    {search ? (
                        <div className="ym-site-header__search">
                            <SearchBar
                                id="site-header-search"
                                placeholder={
                                    enabled.masters
                                        ? ru.header.searchPlaceholderWithMasters
                                        : ru.header.searchPlaceholder
                                }
                                onSearch={onSearch}
                            />
                        </div>
                    ) : null}

                    <div className="ym-site-header__actions">
                        <Button variant="ghost" icon="map-pin" onClick={onCityClick}>
                            {city}
                        </Button>
                        <Button variant="primary" icon="plus" href={HREF_SOON}>
                            {ru.header.sell}
                        </Button>
                        <Button variant="ghost" icon="user" onClick={onLoginClick}>
                            {ru.header.login}
                        </Button>
                    </div>
                </div>
            </div>
        </header>
    );
}
