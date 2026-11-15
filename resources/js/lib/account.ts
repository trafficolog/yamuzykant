import type { IconName } from '@ds';

import { ru } from '@/lang/ru';
import {
    ACCOUNT_PATH,
    FAVORITES_PATH,
    LISTINGS_PATH,
    MESSAGES_PATH,
    PROFILE_PATH,
} from '@/lib/paths';

export type AccountSection =
    'overview' | 'favorites' | 'searches' | 'listings' | 'messages' | 'profile';

/** Группа вкладок (DEVIATIONS «account»): один аккаунт — разделы «Покупаю» и «Продаю». */
export type AccountGroup = 'buy' | 'sell' | null;

export interface AccountNavItem {
    key: AccountSection;
    label: string;
    href: string;
    icon: IconName;
    group: AccountGroup;
}

/**
 * Адреса разделов кабинета. `null` — задача раздела ещё не сделана или раздел вне G1: вкладка не выводится.
 * Когда задача появляется, она ставит сюда свой адрес: 4.3.2 (с G2) — `searches`.
 * (2.1.5 и 4.3.1 уже подставили `listings` и `favorites`.)
 * 4.3.2 (с G2) — `searches`.
 */
export const SECTION_PATHS: Readonly<Record<AccountSection, string | null>> = {
    overview: ACCOUNT_PATH,
    favorites: FAVORITES_PATH,
    searches: null,
    listings: LISTINGS_PATH,
    messages: MESSAGES_PATH,
    profile: PROFILE_PATH,
};

/** Порядок вкладок: «Обзор», «Покупаю», «Продаю», общие «Сообщения» и «Профиль». */
const ORDER: ReadonlyArray<{ key: AccountSection; icon: IconName; group: AccountGroup }> = [
    { key: 'overview', icon: 'layout-grid', group: null },
    { key: 'favorites', icon: 'heart', group: 'buy' },
    { key: 'searches', icon: 'search', group: 'buy' },
    { key: 'listings', icon: 'tag', group: 'sell' },
    { key: 'messages', icon: 'message-circle', group: null },
    { key: 'profile', icon: 'user', group: null },
];

const LABELS: Record<AccountSection, string> = {
    overview: ru.account.overview,
    favorites: ru.account.favorites,
    searches: ru.account.searches,
    listings: ru.account.listings,
    messages: ru.account.messages,
    profile: ru.account.profile,
};

/** Вкладки кабинета: только те, у которых есть адрес. */
export function accountNav(
    sections: Partial<Record<AccountSection, string | null>> = SECTION_PATHS,
): AccountNavItem[] {
    const items: AccountNavItem[] = [];

    const merged = { ...SECTION_PATHS, ...sections };

    for (const { key, icon, group } of ORDER) {
        const href = merged[key];
        if (typeof href === 'string' && href !== '') {
            items.push({ key, label: LABELS[key], href, icon, group });
        }
    }

    return items;
}

/** «на ЯМузыканте с марта 2026» из `ГГГГ-ММ` (shared prop сервера); без даты или с неверной — `null`. */
export function memberSince(month: string | null): string | null {
    const match = month === null ? null : /^(\d{4})-(\d{2})$/.exec(month);
    if (!match) return null;

    const name = ru.account.monthsGenitive[Number(match[2]) - 1];
    return name === undefined ? null : ru.account.since(`${name} ${match[1]}`);
}

/** Первая буква заглавная: подпись в начале строки («На ЯМузыканте с марта 2026»). */
export function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
