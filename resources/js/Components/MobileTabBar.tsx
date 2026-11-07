import { Icon, type IconName } from '@ds';
import { router } from '@inertiajs/react';
import { useRef } from 'react';

import AccountPanel from '@/Components/AccountPanel';
import { openLogin } from '@/Hooks/loginDialog';
import type { AuthUser } from '@/Hooks/useAuthUser';
import { useDisclosure } from '@/Hooks/useDisclosure';
import { ru } from '@/lang/ru';
import { SELL_PATH } from '@/lib/paths';

export type MobileTab = 'home' | 'search' | 'sell' | 'messages' | 'account';

export interface MobileTabBarProps {
    /** Вкладка текущего раздела (`aria-current="page"`); `none` — страница не относится ни к одной. */
    active?: MobileTab | 'none';
    /** Число непрочитанных сообщений; 0 — без счётчика. */
    messages?: number;
    /** Вошедший: «Кабинет» открывает меню кабинета, у гостя — окно входа. */
    user?: AuthUser | null;
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
    { key: 'sell', icon: 'plus', label: ru.tabBar.sell, href: SELL_PATH },
    { key: 'messages', icon: 'message-circle', label: ru.tabBar.messages, href: '#' },
    { key: 'account', icon: 'user', label: ru.tabBar.account, href: '#' },
];

const MAX_COUNT = 99;

const ACCOUNT_TAB_ID = 'tabbar-account';
const ACCOUNT_PANEL_ID = 'tabbar-account-panel';

/**
 * Нижняя панель сайта на экранах < 640 px (на более широких скрыта стилем `.ym-tabbar`).
 *
 * Вкладка — своя ссылка с классами `ym-iconbtn` ДС: `IconButton` не принимает `aria-current`,
 * а текущая вкладка должна быть видна и вспомогательным технологиям. «Кабинет» — кнопка с теми же классами.
 */
export default function MobileTabBar({
    active = 'none',
    messages = 0,
    user = null,
}: MobileTabBarProps) {
    const rootRef = useRef<HTMLElement>(null);
    const account = useDisclosure(rootRef, ACCOUNT_TAB_ID);

    return (
        <nav ref={rootRef} aria-label={ru.tabBar.label} className="ym-tabbar">
            {TABS.map((tab) => {
                const count = tab.key === 'messages' && messages > 0 ? messages : 0;
                const shown = count > MAX_COUNT ? `${MAX_COUNT}+` : String(count);

                if (tab.key === 'account') {
                    // Не ссылка, а кнопка: у «Кабинета» нет адреса. Вошедшему он раскрывает меню кабинета
                    // (disclosure: aria-expanded и aria-controls), гостю открывает окно входа.
                    return (
                        <button
                            key={tab.key}
                            id={ACCOUNT_TAB_ID}
                            type="button"
                            data-login-trigger={user ? undefined : ''}
                            className="ym-iconbtn ym-tabbar__item"
                            aria-current={tab.key === active ? 'page' : undefined}
                            aria-haspopup={user ? undefined : 'dialog'}
                            aria-expanded={user ? account.open : undefined}
                            aria-controls={user && account.open ? ACCOUNT_PANEL_ID : undefined}
                            onClick={(event) => {
                                if (user) {
                                    account.toggle();
                                    return;
                                }
                                // На < 640 px кнопки «Войти» в шапке нет: вход — через «Кабинет».
                                openLogin({ opener: event.currentTarget });
                            }}
                        >
                            <Icon name={tab.icon} size={22} />
                            <span className="ym-tabbar__label">{tab.label}</span>
                        </button>
                    );
                }

                return (
                    <a
                        key={tab.key}
                        href={tab.href}
                        className="ym-iconbtn ym-tabbar__item"
                        aria-current={tab.key === active ? 'page' : undefined}
                        onClick={(event) => {
                            if (tab.key !== 'sell' || user) return;
                            // Гость: сначала вход, затем форма продажи.
                            event.preventDefault();
                            openLogin({
                                opener: event.currentTarget,
                                onAuthenticated: () => router.visit(SELL_PATH),
                            });
                        }}
                        aria-label={
                            tab.key === 'messages' && count > 0
                                ? ru.tabBar.messagesLabel(shown)
                                : undefined
                        }
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
            {user && account.open ? (
                <AccountPanel id={ACCOUNT_PANEL_ID} user={user} variant="sheet" />
            ) : null}
        </nav>
    );
}
