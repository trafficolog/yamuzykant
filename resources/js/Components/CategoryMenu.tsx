import { Button, Icon } from '@ds';
import { useEffect, useRef, useState } from 'react';

import type { FlagName } from '@/Hooks/useFlag';
import type { CategoryNode } from '@/lang/categories';
import { ru } from '@/lang/ru';

export const CATEGORY_MENU_ID = 'site-category-menu';

const SERVICES_TITLE_ID = 'site-category-services';

/** Выдача Барахолки (карточка 3.1.2); адреса отдельных видов появятся вместе со справочником 1.2.1. */
const FLEA_HREF = '/baraholka';

/** Страницы сервисов (проверка, цены продаж, безопасная сделка, форма продажи) — другие задачи. */
const SERVICE_HREF = '#';

type View = 'list' | 'panel';

export interface CategoryMenuProps {
    categories: readonly CategoryNode[];
    /** Включён ли флаг; элементы с выключенным флагом не рендерятся. */
    isEnabled: (flag: FlagName | undefined) => boolean;
    /** Экран < 640 px: меню — модальная шторка (SiteHeader определяет по useNarrow). */
    narrow: boolean;
    /** Закрыть меню; кнопка есть только в шторке на экранах < 640 px. */
    onClose: () => void;
}

/**
 * Меню категорий шапки: слева виды инструментов, справа группы выбранного вида и блок «Сервисы».
 *
 * Роль зависит от экрана (решение 0.2.7):
 * - от 640 px — раскрывающаяся панель без роли диалога: кнопка «Категории» связана с ней через
 *   `aria-controls` и `aria-expanded`, фокус свободно ходит по шапке; уход фокуса из меню закрывает его
 *   (SiteHeader). Для выпадающего списка ссылок диалог с переносом фокуса избыточен;
 * - < 640 px — шторка на весь экран закрывает страницу, поэтому это модальный диалог (`aria-modal`):
 *   фокус переходит в шторку при открытии, не уходит из неё по Tab и сохраняется при переключении видов.
 *
 * Открытием и закрытием (кнопка, Esc, клик вне, уход фокуса) управляет SiteHeader.
 * На < 640 px список видов и группы показывает `data-view` (стиль site.css).
 * В меню нет заголовков: блок «Сервисы» подписан `<p>`, чтобы не нарушать иерархию страницы (h1 первым).
 */
export default function CategoryMenu({
    categories,
    isEnabled,
    narrow,
    onClose,
}: CategoryMenuProps) {
    const [current, setCurrent] = useState(0);
    const [view, setView] = useState<View>('list');
    const rootRef = useRef<HTMLDivElement>(null);
    const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
    /** Куда перевести фокус после смены вида (шторка); при открытии — на первый вид. */
    const pendingFocus = useRef<View | null>(narrow ? 'list' : null);

    const visible = categories.filter((category) => isEnabled(category.flag));
    const selected = visible[current] ?? visible[0];

    /** Кнопка «Все категории» (DS Button не передаёт ref, поэтому ищем её внутри корня меню). */
    const backButton = (): HTMLButtonElement | null | undefined =>
        rootRef.current?.querySelector<HTMLButtonElement>('.ym-site-menu__back');

    // Фокус в шторке: при открытии и после смены вида (скрытый элемент фокус не принимает).
    useEffect(() => {
        const target = pendingFocus.current;
        pendingFocus.current = null;
        if (!target || !narrow) return;
        if (target === 'panel') backButton()?.focus();
        else rowRefs.current[current]?.focus();
    }, [view, narrow, current]);

    // Шторка — модальный диалог: фокус, уведённый за её пределы (поле поиска под ней), возвращается внутрь.
    useEffect(() => {
        if (!narrow) return;

        const onFocusIn = (event: FocusEvent) => {
            const target = event.target;
            if (!(target instanceof Node) || rootRef.current?.contains(target)) return;
            if (view === 'panel') backButton()?.focus();
            else rowRefs.current[current]?.focus();
        };
        document.addEventListener('focusin', onFocusIn);
        return () => document.removeEventListener('focusin', onFocusIn);
    }, [narrow, view, current]);

    if (!selected) return null;

    const services = selected.services.filter((service) => isEnabled(service.flag));

    return (
        <>
            <div className="ym-site-menu__scrim" aria-hidden="true" />
            <div
                id={CATEGORY_MENU_ID}
                ref={rootRef}
                role={narrow ? 'dialog' : undefined}
                aria-modal={narrow ? true : undefined}
                aria-label={narrow ? ru.categoryMenu.label : undefined}
                data-view={view}
                className="ym-site-menu"
            >
                <div className="ym-site-menu__bar">
                    <span className="ym-site-menu__bar-title type-h3">{ru.categoryMenu.label}</span>
                    <Button
                        variant="ghost"
                        icon="x"
                        aria-label={ru.categoryMenu.close}
                        onClick={onClose}
                    />
                </div>
                <div className="ym-site-menu__in">
                    <nav aria-label={ru.categoryMenu.navLabel} className="ym-site-menu__list">
                        {visible.map((category, index) => (
                            <button
                                key={category.name}
                                ref={(element) => {
                                    rowRefs.current[index] = element;
                                }}
                                type="button"
                                className="ym-site-menu__row"
                                aria-current={category === selected ? 'true' : undefined}
                                onMouseEnter={() => setCurrent(index)}
                                onFocus={() => setCurrent(index)}
                                onClick={() => {
                                    pendingFocus.current = narrow ? 'panel' : null;
                                    setCurrent(index);
                                    setView('panel');
                                }}
                            >
                                <span className="ym-site-menu__ico">
                                    <Icon name={category.icon} size={18} />
                                </span>
                                <span className="ym-site-menu__name">{category.name}</span>
                                <span className="ym-site-menu__chev">
                                    <Icon name="chevron-right" size={16} />
                                </span>
                            </button>
                        ))}
                    </nav>

                    <div className="ym-site-menu__panel">
                        {/* В ДС нет стрелки «влево»: chevron-right зеркалится стилем. */}
                        <Button
                            variant="ghost"
                            icon="chevron-right"
                            className="ym-site-menu__back"
                            onClick={() => {
                                pendingFocus.current = narrow ? 'list' : null;
                                setView('list');
                            }}
                        >
                            {ru.categoryMenu.back}
                        </Button>
                        <a href={FLEA_HREF} className="ym-site-menu__title type-h2">
                            {selected.name}
                            <Icon name="chevron-right" size={24} />
                        </a>
                        <div className="ym-site-menu__body">
                            <div className="ym-site-menu__groups">
                                {selected.groups.map((group) => (
                                    <div key={group.title} className="ym-site-menu__group">
                                        <a href={FLEA_HREF} className="ym-site-menu__group-title">
                                            {group.title}
                                            <Icon name="chevron-right" size={16} />
                                        </a>
                                        {group.items.map((item) => (
                                            <a
                                                key={item}
                                                href={FLEA_HREF}
                                                className="ym-site-menu__item type-body-s"
                                            >
                                                {item}
                                            </a>
                                        ))}
                                        {group.more ? (
                                            <a
                                                href={FLEA_HREF}
                                                className="ym-site-menu__item ym-site-menu__item--more type-body-s"
                                            >
                                                {ru.categoryMenu.more(group.more)}
                                            </a>
                                        ) : null}
                                    </div>
                                ))}
                            </div>

                            <aside
                                aria-labelledby={SERVICES_TITLE_ID}
                                className="ym-site-menu__services"
                            >
                                <p id={SERVICES_TITLE_ID} className="ym-site-menu__services-title">
                                    {ru.categoryMenu.servicesLabel}
                                </p>
                                {services.map((service) => (
                                    <a
                                        key={service.label}
                                        href={SERVICE_HREF}
                                        className="ym-site-menu__service type-body-s"
                                    >
                                        <span className="ym-site-menu__service-ico">
                                            <Icon name={service.icon} size={16} />
                                        </span>
                                        {service.label}
                                    </a>
                                ))}
                            </aside>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
