import { describe, expect, it } from 'vitest';

import { accountNav, memberSince } from '@/lib/account';
import { ACCOUNT_PATH, LISTINGS_PATH, MESSAGES_PATH, PROFILE_PATH } from '@/lib/paths';

// 1.1.3: адреса кабинета, состав вкладок («Покупаю» / «Продаю», DEVIATIONS «account») и подпись продавца.

describe('адреса кабинета', () => {
    it('обзор и профиль', () => {
        expect(ACCOUNT_PATH).toBe('/account');
        expect(PROFILE_PATH).toBe('/account/profile');
    });
});

describe('accountNav', () => {
    it('готовы обзор, объявления («Продаю»), сообщения и профиль; «Покупаю» ещё нет', () => {
        const nav = accountNav();

        expect(nav.map((item) => [item.key, item.href, item.group])).toEqual([
            ['overview', ACCOUNT_PATH, null],
            ['listings', LISTINGS_PATH, 'sell'],
            ['messages', MESSAGES_PATH, null],
            ['profile', PROFILE_PATH, null],
        ]);
    });

    it('когда у раздела появляется адрес, он встаёт в свою группу: «Покупаю» → «Продаю» → общие', () => {
        const nav = accountNav({
            favorites: '/account/favorites',
            searches: '/account/searches',
            listings: '/account/listings',
        });

        expect(nav.map((item) => [item.key, item.group])).toEqual([
            ['overview', null],
            ['favorites', 'buy'],
            ['searches', 'buy'],
            ['listings', 'sell'],
            ['messages', null],
            ['profile', null],
        ]);
    });

    it('раздел с пустым адресом не выводится', () => {
        expect(
            accountNav({ favorites: null, listings: '/account/listings' }).map((item) => item.key),
        ).toEqual(['overview', 'listings', 'messages', 'profile']);
    });
});

describe('memberSince', () => {
    it('«на ЯМузыканте с {месяц год}» — месяц в родительном падеже', () => {
        expect(memberSince('2026-03')).toBe('на ЯМузыканте с марта 2026');
        expect(memberSince('2025-12')).toBe('на ЯМузыканте с декабря 2025');
        expect(memberSince('2024-01')).toBe('на ЯМузыканте с января 2024');
    });

    it('без даты или с неверной датой — null', () => {
        expect(memberSince(null)).toBeNull();
        expect(memberSince('2026-13')).toBeNull();
        expect(memberSince('вчера')).toBeNull();
    });
});
