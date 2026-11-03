import { Icon, type IconName } from '@ds';

import { ru } from '@/lang/ru';

export type MobileTab = 'home' | 'search' | 'sell' | 'messages' | 'account';

export interface MobileTabBarProps {
    /** Вкладка текущего раздела (`aria-current="page"`); `none` — страница не относится ни к одной. */
    active?: MobileTab | 'none';
    /** Число непрочитанных сообщений; 0 — без счётчика. */
    messages?: number;
}

interface Tab {
    key: MobileTab;
    icon: IconName;
    label: string;
    href: string;
}

/**
 * «Поиск» — выдача Барахолки (карточка 3.1.2). Форма продажи, сообщения и кабинет — задачи 4.1.2, 4.3.1,
 * 2.1.3: адресов ещё нет, как и у ссылок шапки (0.2.4).
 */
const TABS: readonly Tab[] = [
    { key: 'home', icon: 'layout-grid', label: ru.tabBar.home, href: '/' },
    { key: 'search', icon: 'search', label: ru.tabBar.search, href: '/baraholka' },
    { key: 'sell', icon: 'plus', label: ru.tabBar.sell, href: '#' },
    { key: 'messages', icon: 'message-circle', label: ru.tabBar.messages, href: '#' },
    { key: 'account', icon: 'user', label: ru.tabBar.account, href: '#' },
];

const MAX_COUNT = 99;

/**
 * Нижняя панель сайта на экранах < 640 px (на более широких скрыта стилем `.ym-tabbar`).
 *
 * Вкладка — своя ссылка с классами `ym-iconbtn` ДС: `IconButton` не принимает `aria-current`,
 * а текущая вкладка должна быть видна и вспомогательным технологиям.
 */
export default function MobileTabBar({ active = 'none', messages = 0 }: MobileTabBarProps) {
    return (
        <nav aria-label={ru.tabBar.label} className="ym-tabbar">
            {TABS.map((tab) => {
                const count = tab.key === 'messages' && messages > 0 ? messages : 0;
                const shown = count > MAX_COUNT ? `${MAX_COUNT}+` : String(count);

                return (
                    <a
                        key={tab.key}
                        href={tab.href}
                        className="ym-iconbtn ym-tabbar__item"
                        aria-current={tab.key === active ? 'page' : undefined}
                        aria-label={count > 0 ? `${tab.label}, ${shown}` : undefined}
                    >
                        <Icon name={tab.icon} size={22} />
                        <span className="ym-tabbar__label">{tab.label}</span>
                        {count > 0 ? (
                            <span className="ym-iconbtn__count" aria-hidden="true">
                                {shown}
                            </span>
                        ) : null}
                    </a>
                );
            })}
        </nav>
    );
}
