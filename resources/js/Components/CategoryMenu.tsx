import { Button, Icon } from '@ds';
import { useState } from 'react';

import type { FlagName } from '@/Hooks/useFlag';
import type { CategoryNode } from '@/lang/categories';
import { ru } from '@/lang/ru';

export const CATEGORY_MENU_ID = 'site-category-menu';

const SERVICES_TITLE_ID = 'site-category-services';

/** Выдача Барахолки (карточка 3.1.2); адреса отдельных видов появятся вместе со справочником 1.2.1. */
const FLEA_HREF = '/baraholka';

/** Страницы сервисов (проверка, цены продаж, безопасная сделка, доставка, форма продажи) — другие задачи. */
const SERVICE_HREF = '#';

export interface CategoryMenuProps {
    categories: readonly CategoryNode[];
    /** Включён ли флаг; элементы с выключенным флагом не рендерятся. */
    isEnabled: (flag: FlagName | undefined) => boolean;
    /** Закрыть меню; кнопка есть только в шторке на экранах < 640 px. */
    onClose: () => void;
}

/**
 * Меню категорий шапки: слева виды инструментов, справа группы выбранного вида и блок «Сервисы».
 * Открытием и закрытием (кнопка, Esc, клик вне) управляет SiteHeader.
 * На экранах < 640 px меню — полноэкранная шторка: сначала список видов, по выбору вида — его группы
 * с кнопкой «Все категории» для возврата (`data-view` переключает показ стилем).
 */
export default function CategoryMenu({ categories, isEnabled, onClose }: CategoryMenuProps) {
    const [current, setCurrent] = useState(0);
    const [view, setView] = useState<'list' | 'panel'>('list');
    const visible = categories.filter((category) => isEnabled(category.flag));
    const selected = visible[current] ?? visible[0];

    if (!selected) return null;

    const services = selected.services.filter((service) => isEnabled(service.flag));

    return (
        <>
            <div className="ym-site-menu__scrim" aria-hidden="true" />
            <div
                id={CATEGORY_MENU_ID}
                role="dialog"
                aria-label={ru.categoryMenu.label}
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
                                type="button"
                                className="ym-site-menu__row"
                                aria-current={category === selected ? 'true' : undefined}
                                onMouseEnter={() => setCurrent(index)}
                                onFocus={() => setCurrent(index)}
                                onClick={() => {
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
                            onClick={() => setView('list')}
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
                                <h2 id={SERVICES_TITLE_ID} className="ym-site-menu__services-title">
                                    {ru.categoryMenu.servicesLabel}
                                </h2>
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
