import { getEcho, type RealtimeConfig } from '@/realtime/echo';

type Listener = (unread: number) => void;

interface Subscription {
    channel: string;
    listeners: Set<Listener>;
}

/** Единственная подписка на `private-user.{id}` на вкладку: хук вызывают шапка, нижняя панель и страницы. */
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
    const echo = getEcho(config);
    if (!echo) return () => undefined;

    const channel = `user.${userId}`;
    if (current === null || current.channel !== channel || echoRef !== echo) {
        current = { channel, listeners: new Set() };
        echoRef = echo;
        const subscription = current;
        echo.private(channel).listen('.unread.changed', (payload: unknown) => {
            const unread =
                typeof payload === 'object' && payload !== null
                    ? (payload as { unread?: unknown }).unread
                    : undefined;
            if (typeof unread !== 'number' || !Number.isFinite(unread)) return;
            subscription.listeners.forEach((notify) => notify(Math.max(0, Math.trunc(unread))));
        });
    }

    const subscription = current;
    subscription.listeners.add(listener);

    return () => {
        subscription.listeners.delete(listener);
        if (subscription.listeners.size === 0 && current === subscription) {
            echo.leave(channel);
            current = null;
            echoRef = null;
        }
    };
}
