import { vi } from 'vitest';

import type { ChatConversation, ChatListing, ChatMessage, ConversationListItem } from '@/lib/messages';

// Данные и подмены для тестов экрана сообщений (4.1.2).

export const VIEWER = 1;

/** Объявление в беседе: по умолчанию опубликовано, без обложки (4.1.5). */
export const listing = (extra: Partial<ChatListing> = {}): ChatListing => ({
    id: 'l1',
    title: 'Fender ’57 Stratocaster',
    price: 184_500,
    available: true,
    status: 'published',
    cover: null,
    ...extra,
});

export const conversation = (extra: Partial<ChatConversation> = {}): ChatConversation => ({
    id: 'c1',
    role: 'buying',
    listing: listing(),
    counterpart: { name: 'Андрей К.', deleted: false },
    last_message_at: '2026-09-09T06:28:00Z',
    ...extra,
});

export const message = (
    id: number,
    body: string,
    mine: boolean,
    extra: Partial<ChatMessage> = {},
): ChatMessage => ({
    id,
    conversation_id: 'c1',
    kind: 'text',
    body,
    sender_id: mine ? VIEWER : 2,
    created_at: '2026-09-08T16:08:00Z',
    mine,
    read_at: null,
    client_id: null,
    caution: false,
    ...extra,
});

export const listItem = (
    id: string,
    extra: Partial<ConversationListItem> = {},
): ConversationListItem => ({
    ...conversation({ id }),
    last_message: {
        body: 'Здравствуйте. Шлифовали в «Лад и строй»',
        mine: false,
        kind: 'text',
        created_at: '2026-09-09T06:28:00Z',
    },
    unread: 0,
    ...extra,
});

/** Ответ fetch с телом JSON. */
export const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

type Handler = (payload: unknown) => void;

/** Канал Echo, которым можно «прислать» событие в тесте. */
export function fakeEcho() {
    const handlers = new Map<string, Handler>();
    let onSubscribed: (() => void) | null = null;
    let onError: (() => void) | null = null;
    const channel = {
        subscribed(callback: () => void) {
            onSubscribed = callback;
            return channel;
        },
        error(callback: () => void) {
            onError = callback;
            return channel;
        },
        listen(event: string, callback: Handler) {
            handlers.set(event, callback);
            return channel;
        },
    };
    const echo = { private: vi.fn(() => channel), leave: vi.fn() };

    return {
        echo,
        emit: (event: string, payload: unknown) => handlers.get(event)?.(payload),
        connect: () => onSubscribed?.(),
        fail: () => onError?.(),
    };
}
