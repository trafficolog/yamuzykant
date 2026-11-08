import { usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

import type { RealtimeConfig } from '@/realtime/echo';
import { subscribeUnread } from '@/realtime/userChannel';

// Тип-алиас, а не interface: PageProps из @inertiajs/core требует индексной сигнатуры.
type UnreadProps = {
    auth?: { user?: { id: number } | null };
    messages?: { unread?: number } | null;
    realtime?: RealtimeConfig | null;
};

/**
 * Число непрочитанных сообщений вошедшего (шапка, вкладка «Сообщения»). Начальное значение — shared prop
 * `messages.unread`, дальше — событие `.unread.changed` канала `private-user.{id}` (Reverb) без перезагрузки.
 * Новое значение shared prop (переход, частичная перезагрузка) заменяет живое. У гостя — 0.
 */
export function useUnreadCount(): number {
    const { props } = usePage<UnreadProps>();
    const fromProps = props.messages?.unread ?? 0;
    const userId = props.auth?.user?.id ?? null;
    const realtime = props.realtime ?? null;

    const [live, setLive] = useState<{ source: number; value: number }>({
        source: fromProps,
        value: fromProps,
    });

    // Источник читает слушатель канала: подписка не должна перевыходить на канал при каждом новом значении props.
    const sourceRef = useRef(fromProps);
    sourceRef.current = fromProps;

    // Новое значение с сервера побеждает живое.
    const current = live.source === fromProps ? live.value : fromProps;

    useEffect(() => {
        setLive((state) =>
            state.source === fromProps ? state : { source: fromProps, value: fromProps },
        );
    }, [fromProps]);

    useEffect(() => {
        if (userId === null) return;
        return subscribeUnread(userId, realtime, (unread) =>
            setLive({ source: sourceRef.current, value: unread }),
        );
        // realtime — объект из props: сравниваем по содержимому ключа, а не по ссылке.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, realtime?.key, realtime?.host, realtime?.port, realtime?.scheme]);

    return current;
}
