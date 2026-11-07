import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    HREF_SOON,
    MESSAGES_PATH,
    conversationPath,
    openWriteToSeller,
    writeToSellerPath,
} from '@/lib/paths';

// 4.1.2: адреса сообщений в lib/paths.ts — их используют шапка, кабинет, нижняя панель и страница лота (3.1.5).

const { visit } = vi.hoisted(() => ({ visit: vi.fn() }));
vi.mock('@inertiajs/react', () => ({ router: { visit } }));

beforeEach(() => visit.mockReset());

describe('адреса сообщений', () => {
    it('список, беседа, «Написать продавцу»', () => {
        expect(MESSAGES_PATH).toBe('/messages');
        expect(conversationPath('3f9c')).toBe('/messages/3f9c');
        expect(writeToSellerPath('9b1e')).toBe('/messages?listing=9b1e');
    });

    it('идентификатор в адресе экранируется', () => {
        expect(writeToSellerPath('a b&c')).toBe('/messages?listing=a%20b%26c');
        expect(conversationPath('a/b')).toBe('/messages/a%2Fb');
    });

    it('openWriteToSeller переходит на экран сообщений с черновиком по объявлению', () => {
        openWriteToSeller('9b1e');

        expect(visit).toHaveBeenCalledWith('/messages?listing=9b1e');
    });

    it('заглушка «#» осталась для ещё не сделанных разделов', () => {
        expect(HREF_SOON).toBe('#');
    });
});
