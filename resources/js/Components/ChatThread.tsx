import { Badge, Button, Icon } from '@ds';
import {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type FormEvent,
    type KeyboardEvent,
} from 'react';

import { ru } from '@/lang/ru';
import {
    MAX_LENGTH,
    dayKey,
    formatDay,
    formatPrice,
    formatTime,
    groupDigits,
    initials,
    type BroadcastMessage,
    type ChatConversation,
    type ChatMessage,
    type ComposeTarget,
} from '@/lib/messages';
import {
    loadHistory,
    markRead,
    sendMessage,
    startConversation,
    type SendOutcome,
} from '@/lib/messagesApi';
import { HREF_SOON, lotPath } from '@/lib/paths';
import { getEcho, type RealtimeConfig } from '@/realtime/echo';

export interface ChatThreadProps {
    /** id вошедшего: по нему «моё» и «прочитал собеседник» отличаются от чужого. */
    viewerId: number;
    /** Открытая беседа; `null` — черновик «Написать продавцу» (`compose`). */
    conversation: ChatConversation | null;
    compose: ComposeTarget | null;
    /** Сообщения от старых к новым. */
    messages: readonly ChatMessage[];
    /** Есть ли сообщения старше показанных. */
    hasMore: boolean;
    /** Настройки Reverb (shared prop `realtime`); `null` — без реального времени. */
    realtime: RealtimeConfig | null;
    onBack: () => void;
    /** Что-то изменилось на сервере (отправлено, прочитано): странице обновить список. */
    onChanged?: () => void;
    /** Первое сообщение создало беседу. */
    onStarted?: (conversation: ChatConversation) => void;
    /** Перевести фокус на переписку при открытии (переход по действию пользователя). */
    focusOnOpen?: boolean;
}

type Connection = 'idle' | 'connecting' | 'connected' | 'offline';

interface Pending {
    key: string;
    body: string;
    status: 'sending' | 'failed';
    createdAt: string;
}

type Row =
    | { type: 'day'; key: string; label: string }
    | { type: 'message'; key: string; message: ChatMessage }
    | { type: 'pending'; key: string; pending: Pending };

const t = ru.messages.thread;

/** На сервере (SSR) layout-эффекты не выполняются и предупреждают: там обычный эффект. */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Ширина поля ввода растёт с текстом до этого предела, px (в прототипе 160). */
const FIELD_MAX_HEIGHT = 160;

/** Сообщение из канала: без «моё» и «прочитано» — считаем здесь. */
const fromBroadcast = (payload: BroadcastMessage, viewerId: number): ChatMessage => ({
    ...payload,
    mine: payload.sender_id !== null && payload.sender_id === viewerId,
    read_at: null,
});

const byId = (a: ChatMessage, b: ChatMessage): number => a.id - b.id;

/** Кладёт сообщения в список без дублей (по id); известные сообщения не заменяются. */
function addMessages(current: ChatMessage[], incoming: readonly ChatMessage[]): ChatMessage[] {
    const known = new Set(current.map((message) => message.id));
    const fresh = incoming.filter((message) => !known.has(message.id));
    return fresh.length === 0 ? current : [...current, ...fresh].sort(byId);
}

const isUnreadIncoming = (message: ChatMessage): boolean =>
    !message.mine && message.kind !== 'system' && message.read_at === null;

/**
 * Переписка (4.1.2): шапка с собеседником, карточка объявления, напоминание «платите после осмотра»,
 * сообщения с датами, поле ввода (Enter — отправить, Shift+Enter — перенос строки).
 *
 * Текст сообщения выводится текстовым узлом React с `white-space: pre-line`: HTML не разбирается, ссылки и телефоны
 * не кликабельны (BR-04). Новые сообщения объявляются экранным диктором (`role="log"`, `aria-live="polite"`).
 * Не отправленное сообщение остаётся в переписке с «Не отправлено · Повторить»; 409 (BR-10) блокирует поле с причиной
 * из ответа сервера. Доставка — Reverb, канал `private-conversation.{id}`; без Reverb экран работает по запросам.
 *
 * Поле ввода — собственная композиция (`textarea` растёт с текстом, кнопка «Отправить» круглая, как в макете):
 * `Textarea` ДС рисует видимую подпись и счётчик в подвале и не умеет расти — на экране сообщений нужна строка.
 */
export default function ChatThread({
    viewerId,
    conversation,
    compose,
    messages,
    hasMore,
    realtime,
    onBack,
    onChanged,
    onStarted,
    focusOnOpen = false,
}: ChatThreadProps) {
    const fieldId = useId();
    const noteId = useId();
    const errorId = useId();

    const [items, setItems] = useState<ChatMessage[]>(() => [...messages].sort(byId));
    const [more, setMore] = useState(hasMore);
    const [loadingMore, setLoadingMore] = useState(false);
    const [moreFailed, setMoreFailed] = useState(false);
    const [pending, setPending] = useState<Pending[]>([]);
    const [draft, setDraft] = useState('');
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [closedReason, setClosedReason] = useState<string | null>(
        conversation?.closed_reason ?? null,
    );
    const [connection, setConnection] = useState<Connection>('idle');
    const [readTick, setReadTick] = useState(0);

    const logRef = useRef<HTMLDivElement>(null);
    const fieldRef = useRef<HTMLTextAreaElement>(null);
    const pinned = useRef(true);
    const sequence = useRef(0);
    const marking = useRef(false);
    const callbacks = useRef({ onChanged, onStarted });
    useEffect(() => {
        callbacks.current = { onChanged, onStarted };
    });

    const conversationId = conversation?.id ?? null;
    const name = conversation?.counterpart.name ?? compose?.counterpart.name ?? '';
    const listing = conversation?.listing ?? null;
    const listingTitle = listing?.title ?? compose?.listing.title ?? null;
    const listingPrice = listing ? listing.price : (compose?.listing.price ?? null);
    const listingId = listing?.id ?? compose?.listing.id ?? null;
    const listingActive = listing?.available ?? true;
    const buying = conversation ? conversation.role === 'buying' : true;
    const closed = closedReason !== null;

    // Первый показ: к последним сообщениям; фокус — на переписку, если открыли действием пользователя.
    useIsoLayoutEffect(() => {
        const log = logRef.current;
        if (!log) return;
        log.scrollTop = log.scrollHeight;
        if (focusOnOpen) log.focus({ preventScroll: true });
    }, [conversationId, focusOnOpen]);

    // Новые сообщения: прокрутка вниз, пока читатель внизу, и всегда после своей отправки.
    useIsoLayoutEffect(() => {
        const log = logRef.current;
        if (log && pinned.current) log.scrollTop = log.scrollHeight;
    }, [items.length, pending.length]);

    // Поле растёт с текстом.
    useIsoLayoutEffect(() => {
        const field = fieldRef.current;
        if (!field) return;
        field.style.height = 'auto';
        field.style.height = `${Math.min(field.scrollHeight, FIELD_MAX_HEIGHT)}px`;
    }, [draft]);

    // Догнать сервер: пропущенные сообщения, «прочитано», причина закрытия (после обрыва связи).
    const resync = useCallback(async () => {
        if (conversationId === null) return;
        const page = await loadHistory(conversationId);
        if (page === null) return;
        setItems((current) => {
            const fresh = new Map(page.messages.map((message) => [message.id, message]));
            const merged = current.map((message) => fresh.get(message.id) ?? message);
            return addMessages(merged, page.messages);
        });
        setClosedReason(page.conversation.closed_reason);
    }, [conversationId]);

    // Realtime: сообщения и «прочитано» беседы. Без настроек Reverb канала нет.
    useEffect(() => {
        if (conversationId === null) return;
        const echo = getEcho(realtime);
        if (!echo) {
            setConnection('idle');
            return;
        }
        setConnection('connecting');
        const channelName = `conversation.${conversationId}`;
        let connectedBefore = false;

        echo.private(channelName)
            .subscribed(() => {
                setConnection('connected');
                if (connectedBefore) void resync();
                connectedBefore = true;
            })
            .error(() => setConnection('offline'))
            .listen('.message.sent', (payload: BroadcastMessage) => {
                if (payload.conversation_id !== conversationId) return;
                setItems((current) => addMessages(current, [fromBroadcast(payload, viewerId)]));
            })
            .listen(
                '.conversation.read',
                (payload: { reader_id: number; read_at: string; conversation_id?: string }) => {
                    // Собственная отметка (другая вкладка) не значит, что собеседник прочитал мои сообщения.
                    if (payload.reader_id === viewerId) return;
                    setItems((current) =>
                        current.map((message) =>
                            message.mine && message.read_at === null
                                ? { ...message, read_at: payload.read_at }
                                : message,
                        ),
                    );
                },
            );

        const onOffline = () => setConnection('offline');
        const onOnline = () => void resync();
        window.addEventListener('offline', onOffline);
        window.addEventListener('online', onOnline);

        return () => {
            window.removeEventListener('offline', onOffline);
            window.removeEventListener('online', onOnline);
            echo.leave(channelName);
        };
        // realtime — объект из props: сравниваем по содержимому, а не по ссылке.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        conversationId,
        viewerId,
        resync,
        realtime?.key,
        realtime?.host,
        realtime?.port,
        realtime?.scheme,
    ]);

    // «Прочитано»: когда в открытой беседе есть непрочитанные от собеседника и вкладка видна.
    const unreadKey = items
        .filter(isUnreadIncoming)
        .map((message) => message.id)
        .join(',');
    useEffect(() => {
        if (conversationId === null || unreadKey === '' || marking.current) return;
        if (document.visibilityState === 'hidden') {
            const wake = () => {
                if (document.visibilityState !== 'hidden') setReadTick((tick) => tick + 1);
            };
            document.addEventListener('visibilitychange', wake);
            return () => document.removeEventListener('visibilitychange', wake);
        }

        marking.current = true;
        const upTo = Math.max(...unreadKey.split(',').map(Number));
        void markRead(conversationId).then((ok) => {
            marking.current = false;
            if (!ok) return;
            const now = new Date().toISOString();
            setItems((current) =>
                current.map((message) =>
                    isUnreadIncoming(message) && message.id <= upTo
                        ? { ...message, read_at: now }
                        : message,
                ),
            );
            callbacks.current.onChanged?.();
            // Пока шёл запрос, могло прийти новое сообщение: проверить ещё раз.
            setReadTick((tick) => tick + 1);
        });
    }, [conversationId, unreadKey, readTick]);

    const length = Array.from(draft.trim()).length;
    const tooLong = length > MAX_LENGTH;
    const canSend = !closed && length > 0 && !tooLong;

    const deliver = useCallback(
        async (key: string, body: string) => {
            let outcome: SendOutcome;
            if (conversationId !== null) {
                outcome = await sendMessage(conversationId, body);
            } else if (compose) {
                outcome = await startConversation(compose.listing.id, body);
            } else {
                outcome = { kind: 'unavailable' };
            }

            const drop = () => setPending((current) => current.filter((item) => item.key !== key));

            switch (outcome.kind) {
                case 'sent':
                    drop();
                    if (outcome.conversation) {
                        callbacks.current.onStarted?.(outcome.conversation);
                        return;
                    }
                    setItems((current) => addMessages(current, [outcome.message]));
                    callbacks.current.onChanged?.();
                    return;
                case 'closed':
                    // Сервер не принял: сообщения нет, текст возвращается в поле, поле блокируется причиной.
                    drop();
                    setDraft(body);
                    setClosedReason(outcome.reason || t.readOnlyDefault);
                    return;
                case 'unavailable':
                    drop();
                    setDraft(body);
                    setClosedReason(t.listingGone);
                    return;
                case 'invalid':
                    drop();
                    setDraft(body);
                    setFieldError(outcome.error || ru.messages.sendError);
                    return;
                case 'failed':
                    setPending((current) =>
                        current.map((item) =>
                            item.key === key ? { ...item, status: 'failed' } : item,
                        ),
                    );
                    return;
            }
        },
        [conversationId, compose],
    );

    const send = () => {
        if (!canSend) return;
        const body = draft.trim();
        const key = `local-${(sequence.current += 1)}`;
        pinned.current = true;
        setPending((current) => [
            ...current,
            { key, body, status: 'sending', createdAt: new Date().toISOString() },
        ]);
        setDraft('');
        setFieldError(null);
        void deliver(key, body);
    };

    const retry = (item: Pending) => {
        setPending((current) =>
            current.map((entry) =>
                entry.key === item.key ? { ...entry, status: 'sending' } : entry,
            ),
        );
        void deliver(item.key, item.body);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
        event.preventDefault();
        send();
    };

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        send();
    };

    const loadEarlier = async () => {
        if (conversationId === null || items.length === 0 || loadingMore) return;
        setLoadingMore(true);
        setMoreFailed(false);
        const first = items[0] as ChatMessage;
        const log = logRef.current;
        const before = log ? log.scrollHeight - log.scrollTop : 0;
        const page = await loadHistory(conversationId, first.id);
        setLoadingMore(false);
        if (page === null) {
            setMoreFailed(true);
            return;
        }
        pinned.current = false;
        setItems((current) => addMessages(current, page.messages));
        setMore(page.hasMore);
        // Позиция чтения не прыгает: прокрутка сохраняет расстояние до нижнего края.
        requestAnimationFrame(() => {
            if (log) log.scrollTop = log.scrollHeight - before;
        });
    };

    const rows = useMemo<Row[]>(() => {
        const result: Row[] = [];
        let lastDay = '';
        const push = (iso: string) => {
            const day = dayKey(iso);
            if (day === lastDay) return;
            lastDay = day;
            result.push({ type: 'day', key: `day-${day}`, label: formatDay(iso) });
        };
        for (const message of items) {
            push(message.created_at);
            result.push({ type: 'message', key: `m-${message.id}`, message });
        }
        for (const item of pending) {
            push(item.createdAt);
            result.push({ type: 'pending', key: item.key, pending: item });
        }
        return result;
    }, [items, pending]);

    const showQuick = !closed && draft === '' && buying;
    const error = tooLong ? t.tooLong(groupDigits(MAX_LENGTH)) : fieldError;
    const lotHref = listingId === null ? HREF_SOON : lotPath(listingId);

    const listingBody = (
        <>
            <span className="ym-chat__listing-thumb" aria-hidden="true">
                <Icon name="guitar" size={24} />
            </span>
            <span className="ym-chat__listing-text">
                <span className="body ym-chat__listing-title">{listingTitle}</span>
                <span className="body-s ym-chat__listing-price">{formatPrice(listingPrice)}</span>
            </span>
            <Badge tone={listingActive ? 'accent' : 'neutral'}>
                {listingActive ? t.listingActive : t.listingClosed}
            </Badge>
        </>
    );

    return (
        <div className="ym-chat" data-connection={connection}>
            <header className="ym-chat__head">
                <button
                    type="button"
                    className="ym-messages__round"
                    aria-label={t.close}
                    onClick={onBack}
                >
                    <span className="ym-chat__back" aria-hidden="true">
                        <Icon name="chevron-right" size={20} />
                    </span>
                </button>
                <span className="ym-chat__avatar" aria-hidden="true">
                    {conversation?.counterpart.deleted ? (
                        <Icon name="user" size={20} />
                    ) : (
                        initials(name)
                    )}
                </span>
                <div className="ym-chat__who">
                    <h2 className="body ym-chat__name">{name}</h2>
                    <p className="body-s ym-chat__role">{buying ? t.roleSeller : t.roleBuyer}</p>
                </div>
            </header>

            <section aria-label={t.listing} className="ym-chat__listing">
                {lotHref === HREF_SOON ? (
                    <div className="ym-chat__listing-in">{listingBody}</div>
                ) : (
                    <a className="ym-chat__listing-in" href={lotHref}>
                        {listingBody}
                    </a>
                )}
            </section>

            {connection === 'offline' ? (
                <p role="status" className="body-s ym-chat__offline">
                    {t.offline}
                </p>
            ) : null}

            <div
                ref={logRef}
                role="log"
                // Прокручиваемая область достижима с клавиатуры (axe: scrollable-region-focusable).
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={0}
                aria-live="polite"
                aria-relevant="additions"
                aria-label={ru.messages.thread.logLabel(name)}
                className="ym-chat__log"
                onScroll={(event) => {
                    const log = event.currentTarget;
                    pinned.current = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
                }}
            >
                {more ? (
                    <div className="ym-chat__earlier">
                        <Button
                            variant="outline"
                            size="s"
                            loading={loadingMore}
                            onClick={() => void loadEarlier()}
                        >
                            {t.earlier}
                        </Button>
                        {moreFailed ? (
                            <p className="caption ym-chat__earlier-error">{t.earlierFailed}</p>
                        ) : null}
                    </div>
                ) : null}

                <div className="ym-chat__system ym-chat__safety">
                    <p className="body ym-chat__system-title">{t.safetyTitle}</p>
                    <p className="body-s">{t.safetyText}</p>
                </div>

                {conversation === null && items.length === 0 ? (
                    <p className="body-s ym-chat__hint">{t.composeHint}</p>
                ) : null}

                <ul className="ym-chat__list">
                    {rows.map((row) => {
                        if (row.type === 'day') {
                            return (
                                <li key={row.key} className="caption ym-chat__day" data-dynamic>
                                    {row.label}
                                </li>
                            );
                        }
                        if (row.type === 'pending') {
                            return (
                                <li key={row.key} className="ym-chat__row ym-chat__row--out">
                                    <div className="ym-chat__bubble ym-chat__bubble--out ym-chat__bubble--pending">
                                        <p className="body ym-chat__text">{row.pending.body}</p>
                                    </div>
                                    {row.pending.status === 'failed' ? (
                                        <p className="caption ym-chat__failed">
                                            <span>{t.notSent}</span>
                                            <span aria-hidden="true"> · </span>
                                            <button
                                                type="button"
                                                className="ym-chat__retry"
                                                onClick={() => retry(row.pending)}
                                            >
                                                {t.retry}
                                            </button>
                                        </p>
                                    ) : (
                                        <p className="caption ym-chat__failed ym-chat__sending">
                                            {t.sending}
                                        </p>
                                    )}
                                </li>
                            );
                        }

                        const { message } = row;
                        if (message.kind === 'system') {
                            return (
                                <li key={row.key} className="ym-chat__row ym-chat__row--system">
                                    <div className="ym-chat__system">
                                        <p className="body-s ym-chat__text">{message.body}</p>
                                    </div>
                                </li>
                            );
                        }
                        return (
                            <li
                                key={row.key}
                                className={`ym-chat__row ym-chat__row--${message.mine ? 'out' : 'in'}`}
                            >
                                <div
                                    className={`ym-chat__bubble ym-chat__bubble--${message.mine ? 'out' : 'in'}`}
                                >
                                    <p className="body ym-chat__text">{message.body}</p>
                                    <span className="caption ym-chat__meta">
                                        <time dateTime={message.created_at} data-dynamic>
                                            {formatTime(message.created_at)}
                                        </time>
                                        {message.mine ? (
                                            <span
                                                role="img"
                                                className={`ym-chat__tick${message.read_at ? ' is-read' : ''}`}
                                                aria-label={message.read_at ? t.read : t.sent}
                                                title={message.read_at ? t.read : t.sent}
                                            >
                                                <Icon name="check" size={14} />
                                            </span>
                                        ) : null}
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <div className="ym-chat__foot">
                {showQuick ? (
                    <div role="group" aria-label={t.quickLabel} className="ym-chat__quick">
                        {t.quick.map((label) => (
                            <button
                                key={label}
                                type="button"
                                className="body-s ym-chat__quick-item"
                                onClick={() => {
                                    setDraft(label);
                                    fieldRef.current?.focus();
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                ) : null}

                {closedReason !== null ? (
                    <p id={noteId} className="body-s ym-chat__readonly">
                        {closedReason}
                    </p>
                ) : null}
                {error !== null ? (
                    <p id={errorId} role="alert" className="body-s ym-chat__error">
                        {error}
                    </p>
                ) : null}

                <form className="ym-chat__form" onSubmit={onSubmit}>
                    <label htmlFor={fieldId} className="ym-sr">
                        {ru.messages.field}
                    </label>
                    <textarea
                        id={fieldId}
                        ref={fieldRef}
                        rows={1}
                        className="body ym-chat__field"
                        placeholder={t.placeholder}
                        value={draft}
                        disabled={closed}
                        aria-invalid={error !== null ? true : undefined}
                        aria-describedby={
                            [closed ? noteId : null, error !== null ? errorId : null]
                                .filter(Boolean)
                                .join(' ') || undefined
                        }
                        onChange={(event) => {
                            setDraft(event.target.value);
                            if (fieldError !== null) setFieldError(null);
                        }}
                        onKeyDown={onKeyDown}
                    />
                    <button
                        type="submit"
                        className="ym-chat__send"
                        aria-label={ru.messages.send}
                        disabled={!canSend}
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M14.5 21.7a.5.5 0 0 0 .9 0L22 2.6a.5.5 0 0 0-.6-.6L2.3 8.6a.5.5 0 0 0 0 .9l8 3.2a2 2 0 0 1 1.1 1.1z" />
                            <path d="m21.9 2.1-10.9 11" />
                        </svg>
                    </button>
                </form>
                {length >= MAX_LENGTH - 200 ? (
                    <span className="caption ym-chat__count">{`${groupDigits(length)} / ${groupDigits(MAX_LENGTH)}`}</span>
                ) : null}
            </div>
        </div>
    );
}
