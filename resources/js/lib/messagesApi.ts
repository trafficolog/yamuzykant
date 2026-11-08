import type { ChatConversation, ChatMessage } from '@/lib/messages';
import { postJson } from '@/lib/postJson';

/** Итог отправки сообщения: решает вызывающий (ChatThread), исключений наружу нет. */
export type SendOutcome =
    | { kind: 'sent'; message: ChatMessage; conversation: ChatConversation | null }
    | /** 409: писать больше нельзя (BR-10, собеседник удалил аккаунт) — причина из ответа сервера. */ {
          kind: 'closed';
          reason: string;
      }
    | /** 422: текст не принят (пусто, длиннее 2000) — сообщение сервера. */ {
          kind: 'invalid';
          error: string;
      }
    | /** 404: беседы или объявления больше нет для этого пользователя. */ { kind: 'unavailable' }
    | /** Нет сети, 5xx, 429, 419: повтор возможен. */ { kind: 'failed'; status: number | null };

function text(value: unknown): string | null {
    return typeof value === 'string' && value !== '' ? value : null;
}

function firstError(body: Record<string, unknown>): string | null {
    const errors = body.errors;
    if (typeof errors === 'object' && errors !== null) {
        const list = (errors as Record<string, unknown>).body;
        if (Array.isArray(list)) return text(list[0]);
    }
    return text(body.message);
}

async function send(
    url: string,
    body: string,
    pick: (payload: Record<string, unknown>) => {
        message: ChatMessage;
        conversation: ChatConversation | null;
    },
): Promise<SendOutcome> {
    let result;
    try {
        result = await postJson(url, { body });
    } catch {
        return { kind: 'failed', status: null };
    }

    if (result.status === 201) {
        return { kind: 'sent', ...pick(result.body) };
    }
    if (result.status === 409) {
        return { kind: 'closed', reason: text(result.body.message) ?? '' };
    }
    if (result.status === 422) {
        return { kind: 'invalid', error: firstError(result.body) ?? '' };
    }
    if (result.status === 404) {
        return { kind: 'unavailable' };
    }
    return { kind: 'failed', status: result.status };
}

/** Сообщение в существующую беседу: POST /conversations/{id}/messages (4.1.1). */
export function sendMessage(conversationId: string, body: string): Promise<SendOutcome> {
    return send(`/conversations/${conversationId}/messages`, body, (payload) => ({
        message: payload.data as ChatMessage,
        conversation: null,
    }));
}

/** «Написать продавцу»: первое сообщение создаёт беседу по объявлению (POST /listings/{id}/conversations). */
export function startConversation(listingId: string, body: string): Promise<SendOutcome> {
    return send(`/listings/${listingId}/conversations`, body, (payload) => ({
        message: payload.message as ChatMessage,
        conversation: payload.conversation as ChatConversation,
    }));
}

/** Отметить сообщения собеседника прочитанными; `true` — сервер принял. */
export async function markRead(conversationId: string): Promise<boolean> {
    try {
        const { status } = await postJson(`/conversations/${conversationId}/read`, {});
        return status >= 200 && status < 300;
    } catch {
        return false;
    }
}

export interface HistoryPage {
    conversation: ChatConversation;
    messages: ChatMessage[];
    hasMore: boolean;
}

/**
 * Страница истории: последние сообщения или до курсора `before` (id самого старого показанного).
 * `null` — запрос не удался.
 */
export async function loadHistory(
    conversationId: string,
    before: number | null = null,
): Promise<HistoryPage | null> {
    const query = before === null ? '' : `?before=${before}`;
    try {
        const response = await fetch(`/conversations/${conversationId}/messages${query}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        });
        if (!response.ok) return null;
        const payload = (await response.json()) as {
            conversation: ChatConversation;
            data: ChatMessage[];
            meta: { has_more: boolean };
        };
        return {
            conversation: payload.conversation,
            messages: payload.data,
            hasMore: payload.meta.has_more,
        };
    } catch {
        return null;
    }
}
