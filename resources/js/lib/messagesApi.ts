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
    | /** 429 с кодом new_chats_limit: суточный лимит новых чатов — текст сервера, повтор сегодня не поможет. */ {
          kind: 'limited';
          error: string;
      }
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
    clientId: string,
    pick: (payload: Record<string, unknown>) => {
        message: ChatMessage;
        conversation: ChatConversation | null;
    },
): Promise<SendOutcome> {
    let result;
    try {
        result = await postJson(url, { body, client_id: clientId });
    } catch {
        return { kind: 'failed', status: null };
    }

    // 201 — сохранено; 200 — повтор с тем же client_id вернул уже сохранённое сообщение.
    if (result.status === 201 || result.status === 200) {
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
    if (result.status === 429 && result.body.code === 'new_chats_limit') {
        return { kind: 'limited', error: text(result.body.message) ?? '' };
    }
    return { kind: 'failed', status: result.status };
}

/**
 * Ключ идемпотентности отправки: уникален в беседе; повтор («Повторить») идёт с тем же ключом, и сервер не создаёт дубль.
 */
export function newClientId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Сообщение в существующую беседу: POST /conversations/{id}/messages (4.1.1). */
export function sendMessage(
    conversationId: string,
    body: string,
    clientId: string,
): Promise<SendOutcome> {
    return send(`/conversations/${conversationId}/messages`, body, clientId, (payload) => ({
        message: payload.data as ChatMessage,
        conversation: null,
    }));
}

/** «Написать продавцу»: первое сообщение создаёт беседу по объявлению (POST /listings/{id}/conversations). */
export function startConversation(
    listingId: string,
    body: string,
    clientId: string,
): Promise<SendOutcome> {
    return send(`/listings/${listingId}/conversations`, body, clientId, (payload) => ({
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
