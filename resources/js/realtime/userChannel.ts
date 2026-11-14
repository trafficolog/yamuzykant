import { getEcho, type RealtimeConfig } from '@/realtime/echo';

type Listener = (unread: number) => void;
/** Сообщение получателя признано подозрительным (`.message.cautioned`): плашка «Будьте осторожны». */
type CautionListener = (conversationId: string, messageId: number) => void;

interface Subscription {
    channel: string;
    listeners: Set<Listener>;
    cautions: Set<CautionListener>;
}

/** Единственная подписка на `private-user.{id}` на вкладку: счётчик читают шапка, нижняя панель и страницы, плашку — чат. */
let current: Subscription | null = null;
let echoRef: ReturnType<typeof getEcho> = null;

/**
 * Подписывает `listener` на счётчик непрочитанных (`.unread.changed`) канала пользователя. Канал открывается
 * при первом слушателе и закрывается после ухода последнего. Без настроек realtime (гость, Reverb выключен)
 * ничего не делает. Возвращает отписку.
 */
export function subscribeUnread(
    userId: number,
    config: RealtimeConfig | null | undefined,
    listener: Listener,
): () => void {
    return attach(
        userId,
        config,
        (subscription) => subscription.listeners.add(listener),
        (subscription) => subscription.listeners.delete(listener),
    );
}

/**
 * Подписывает `listener` на `.message.cautioned` канала пользователя: плашка «Будьте осторожны» только получателю
 * (в канал беседы признак не уходит — его увидел бы отправитель). Канал тот же, что у счётчика. Возвращает отписку.
 */
export function subscribeCautioned(
    userId: number,
    config: RealtimeConfig | null | undefined,
    listener: CautionListener,
): () => void {
    return attach(
        userId,
        config,
        (subscription) => subscription.cautions.add(listener),
        (subscription) => subscription.cautions.delete(listener),
    );
}

function attach(
    userId: number,
    config: RealtimeConfig | null | undefined,
    add: (subscription: Subscription) => void,
    remove: (subscription: Subscription) => void,
): () => void {
    const echo = getEcho(config);
    if (!echo) return () => undefined;

    const channel = `user.${userId}`;
    if (current === null || current.channel !== channel || echoRef !== echo) {
        current = { channel, listeners: new Set(), cautions: new Set() };
        echoRef = echo;
        const subscription = current;
        echo.private(channel)
            .listen('.unread.changed', (payload: unknown) => {
                const unread =
                    typeof payload === 'object' && payload !== null
                        ? (payload as { unread?: unknown }).unread
                        : undefined;
                if (typeof unread !== 'number' || !Number.isFinite(unread)) return;
                subscription.listeners.forEach((notify) => notify(Math.max(0, Math.trunc(unread))));
            })
            .listen('.message.cautioned', (payload: unknown) => {
                const data =
                    typeof payload === 'object' && payload !== null
                        ? (payload as { conversation_id?: unknown; message_id?: unknown })
                        : {};
                if (typeof data.conversation_id !== 'string' || typeof data.message_id !== 'number')
                    return;
                const { conversation_id: conversationId, message_id: messageId } = data;
                subscription.cautions.forEach((notify) => notify(conversationId, messageId));
            });
    }

    const subscription = current;
    add(subscription);

    return () => {
        remove(subscription);
        if (
            subscription.listeners.size === 0 &&
            subscription.cautions.size === 0 &&
            current === subscription
        ) {
            echo.leave(channel);
            current = null;
            echoRef = null;
        }
    };
}
