import { Head, usePage } from '@inertiajs/react';
import { useEffect, useState, type FormEvent } from 'react';

import { Button, Textarea } from '@ds';
import { ru } from '@/lang/ru';
import { getEcho, type RealtimeConfig } from '@/realtime/echo';

/** Сообщение, как его отдают MessageResource и событие `.message.sent`. */
interface ChatMessage {
    id: number;
    conversation_id: string;
    kind: 'text' | 'system' | 'offer';
    body: string;
    sender_id: number | null;
    created_at: string;
}

interface Conversation {
    id: string;
    counterpart: { name: string; deleted: boolean };
}

interface Props {
    listingId: string;
    conversation: Conversation | null;
    messages: ChatMessage[];
}

type Connection = 'connecting' | 'connected' | 'offline';

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : '';
}

/**
 * Служебная страница доставки сообщений для e2e UC-D1 до экрана сообщений (4.1.2). Только local, testing, e2e.
 * Текст выводится текстовым узлом React — HTML из сообщения не исполняется.
 */
export default function MessagingPlayground({ listingId, conversation, messages }: Props) {
    const realtime = usePage<{ realtime: RealtimeConfig | null }>().props.realtime;
    const [items, setItems] = useState<ChatMessage[]>(messages);
    const [connection, setConnection] = useState<Connection>('connecting');
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const echo = getEcho(realtime);
        if (!echo || !conversation) {
            setConnection('offline');
            return;
        }
        const name = `conversation.${conversation.id}`;
        const channel = echo.private(name);
        channel
            .subscribed(() => setConnection('connected'))
            .error(() => setConnection('offline'))
            .listen('.message.sent', (message: ChatMessage) =>
                setItems((current) =>
                    current.some((item) => item.id === message.id)
                        ? current
                        : [...current, message],
                ),
            );
        return () => echo.leave(name);
    }, [realtime, conversation]);

    async function send(event: FormEvent) {
        event.preventDefault();
        if (!conversation || draft.trim() === '') return;
        setSending(true);
        setError(null);
        try {
            const response = await fetch(`/conversations/${conversation.id}/messages`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': xsrfToken(),
                },
                body: JSON.stringify({ body: draft }),
            });
            if (!response.ok) throw new Error(String(response.status));
            const { data } = (await response.json()) as { data: ChatMessage };
            setItems((current) =>
                current.some((item) => item.id === data.id) ? current : [...current, data],
            );
            setDraft('');
        } catch {
            setError(ru.messages.sendError);
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="ym-root">
            <Head title={ru.messages.title} />
            <main
                style={{
                    maxWidth: 'var(--content-max)',
                    margin: '0 auto',
                    padding: 'var(--space-8) var(--space-6)',
                    display: 'grid',
                    gap: 'var(--space-5)',
                }}
            >
                <h1 className="type-h3">{ru.messages.title}</h1>
                <p className="type-body-s" style={{ margin: 0 }}>
                    {ru.messages.listing}: <span data-testid="listing-id">{listingId}</span>
                </p>
                {conversation && (
                    <>
                        <p className="type-body-s" style={{ margin: 0 }}>
                            {conversation.counterpart.name}
                        </p>
                        <p role="status" className="type-caption" style={{ margin: 0 }}>
                            {ru.messages[connection]}
                        </p>
                        <ul
                            style={{
                                display: 'grid',
                                gap: 'var(--space-2)',
                                margin: 0,
                                padding: 0,
                            }}
                        >
                            {items.map((message) => (
                                <li
                                    key={message.id}
                                    className="type-body"
                                    style={{ listStyle: 'none', whiteSpace: 'pre-wrap' }}
                                >
                                    {message.body}
                                </li>
                            ))}
                        </ul>
                        <form onSubmit={send} style={{ display: 'grid', gap: 'var(--space-3)' }}>
                            <Textarea
                                label={ru.messages.field}
                                value={draft}
                                onChange={setDraft}
                                rows={3}
                                error={error ?? undefined}
                            />
                            <Button type="submit" loading={sending}>
                                {ru.messages.send}
                            </Button>
                        </form>
                    </>
                )}
            </main>
        </div>
    );
}
