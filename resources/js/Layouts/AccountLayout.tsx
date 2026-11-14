import { Icon } from '@ds';
import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';

import { useUnreadCount } from '@/Hooks/useUnreadCount';
import PublicLayout from '@/Layouts/PublicLayout';
import { ru } from '@/lang/ru';
import {
    accountNav,
    type AccountGroup,
    type AccountNavItem,
    type AccountSection,
} from '@/lib/account';

export interface AccountLayoutProps {
    /** Раздел, который открыт: его вкладка получает `aria-current="page"`. */
    active: AccountSection;
    /** Адреса разделов; по умолчанию — `SECTION_PATHS`. Нужен витринам и тестам. */
    sections?: Partial<Record<AccountSection, string | null>>;
    children?: ReactNode;
}

const GROUP_LABEL: Record<Exclude<AccountGroup, null>, string> = {
    buy: ru.account.buy,
    sell: ru.account.sell,
};

type Segment =
    | { kind: 'item'; item: AccountNavItem }
    | { kind: 'group'; group: Exclude<AccountGroup, null>; items: AccountNavItem[] };

/** Подряд идущие вкладки одной группы собираются в одну подписанную группу. */
function segments(items: AccountNavItem[]): Segment[] {
    const result: Segment[] = [];

    for (const item of items) {
        const last = result[result.length - 1];
        if (item.group === null) {
            result.push({ kind: 'item', item });
        } else if (last?.kind === 'group' && last.group === item.group) {
            last.items.push(item);
        } else {
            result.push({ kind: 'group', group: item.group, items: [item] });
        }
    }

    return result;
}

function Tab({ item, active, unread }: { item: AccountNavItem; active: boolean; unread: number }) {
    const count = item.key === 'messages' && unread > 0 ? unread : 0;
    const shown = count > 99 ? '99+' : String(count);

    return (
        <Link
            href={item.href}
            className="ym-account-nav__tab"
            aria-current={active ? 'page' : undefined}
            aria-label={count > 0 ? ru.account.messagesLabel(shown) : undefined}
        >
            <Icon name={item.icon} size={18} />
            <span>{item.label}</span>
            {count > 0 ? (
                <span className="ym-account-nav__count" aria-hidden="true">
                    {shown}
                </span>
            ) : null}
        </Link>
    );
}

/**
 * Каркас кабинета (UC-A2): заголовок «Кабинет» и вкладки поверх PublicLayout. Вкладки — по `accountNav`:
 * «Обзор», группы «Покупаю» и «Продаю» (появляются, когда у их разделов есть адрес), «Сообщения», «Профиль».
 * Подключается постоянной раскладкой: `Page.layout = (page) => <AccountLayout active="profile">{page}</AccountLayout>`.
 */
export default function AccountLayout({ active, sections, children }: AccountLayoutProps) {
    const unread = useUnreadCount();
    const items = accountNav(sections);
    const current = items.find((item) => item.key === active);

    return (
        <PublicLayout title={current?.label ?? ru.account.title} tab="account">
            <div className="ym-account-page">
                <header className="ym-account-page__head">
                    <h1 className="type-h1 ym-account-page__title">{ru.account.title}</h1>
                    <nav aria-label={ru.account.nav} className="ym-account-nav">
                        <ul className="ym-account-nav__list">
                            {segments(items).map((segment) =>
                                segment.kind === 'item' ? (
                                    <li key={segment.item.key}>
                                        <Tab
                                            item={segment.item}
                                            active={segment.item.key === active}
                                            unread={unread}
                                        />
                                    </li>
                                ) : (
                                    <li key={segment.group} className="ym-account-nav__group">
                                        <span
                                            id={`account-nav-${segment.group}`}
                                            className="ym-account-nav__group-label"
                                        >
                                            {GROUP_LABEL[segment.group]}
                                        </span>
                                        <ul
                                            aria-labelledby={`account-nav-${segment.group}`}
                                            className="ym-account-nav__list"
                                        >
                                            {segment.items.map((item) => (
                                                <li key={item.key}>
                                                    <Tab
                                                        item={item}
                                                        active={item.key === active}
                                                        unread={unread}
                                                    />
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                ),
                            )}
                        </ul>
                    </nav>
                </header>
                <div className="ym-account-page__body">{children}</div>
            </div>
        </PublicLayout>
    );
}
