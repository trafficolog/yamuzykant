import { Icon } from '@ds';
import { router, usePage } from '@inertiajs/react';
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type ReactNode,
    type RefObject,
} from 'react';

import ChatThread from '@/Components/ChatThread';
import ConversationList from '@/Components/ConversationList';
import { useAuthUser } from '@/Hooks/useAuthUser';
import { useUnreadCount } from '@/Hooks/useUnreadCount';
import PublicLayout from '@/Layouts/PublicLayout';
import { ru } from '@/lang/ru';
import type {
    ChatConversation,
    ChatMessage,
    ComposeTarget,
    ConversationListItem,
} from '@/lib/messages';
import { MESSAGES_PATH, conversationPath } from '@/lib/paths';
import type { RealtimeConfig } from '@/realtime/echo';

interface ActiveConversation {
    conversation: ChatConversation;
    messages: ChatMessage[];
    has_more: boolean;
}

interface Props {
    conversations: ConversationListItem[];
    /** Открытая беседа (`/messages/{id}`). */
    active: ActiveConversation | null;
    /** Черновик «Написать продавцу» (`/messages?listing=…`): беседы ещё нет. */
    compose: ComposeTarget | null;
}

type PageProps = { realtime?: RealtimeConfig | null };

const t = ru.messages;

/** Страница выбирает панель частичным переходом: список остаётся на месте, меняются только `active` и `compose`. */
const paneVisit = () => ({
    only: ['active', 'compose'],
    preserveState: true,
    preserveScroll: true,
});

/** Обновить список и счётчик с сервера (превью, порядок, непрочитанные). */
const listReload = () => ({
    only: ['conversations', 'messages'],
    preserveState: true,
    preserveScroll: true,
});

/** Минимальный промежуток между обновлениями списка, мс. */
const RELOAD_GAP = 300;

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Высота экрана — остаток окна под шапкой (на < 640 px ещё и под нижней панелью, она «липнет» к низу окна):
 * список и переписка прокручиваются внутри себя, поле ввода всегда на виду. До измерения и без JS —
 * запасное значение из CSS.
 */
function useViewportHeight(ref: RefObject<HTMLElement | null>): void {
    useIsoLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;

        const measure = () => {
            const header =
                document.querySelector('.ym-site-header')?.getBoundingClientRect().height ?? 0;
            const tabbar = document.querySelector<HTMLElement>('.ym-tabbar');
            const bar =
                tabbar && getComputedStyle(tabbar).display !== 'none' ? tabbar.offsetHeight : 0;
            element.style.setProperty(
                '--ym-messages-h',
                `${Math.max(0, window.innerHeight - header - bar)}px`,
            );
        };

        measure();
        window.addEventListener('resize', measure);
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        const header = document.querySelector('.ym-site-header');
        if (observer && header) observer.observe(header);

        return () => {
            window.removeEventListener('resize', measure);
            observer?.disconnect();
        };
    }, [ref]);
}

export default function MessagesIndex({ conversations, active, compose }: Props) {
    const user = useAuthUser();
    const { props } = usePage<PageProps>();
    const unread = useUnreadCount();
    const rootRef = useRef<HTMLDivElement>(null);
    const [focusOnOpen, setFocusOnOpen] = useState(false);
    const lastReload = useRef(0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const previousUnread = useRef(unread);
    // Беседа, закрытая кнопкой «Закрыть чат»: после перехода к списку фокус возвращается на её строку.
    const returnFocusTo = useRef<string | null>(null);

    useViewportHeight(rootRef);

    // Обновления списка идут сразу, но не чаще раза в 300 мс: лишний вызов откладывается в один повтор.
    // Новый запрос Inertia отменяет прежний, поэтому «зависшего» обновления быть не может.
    const refreshList = useCallback(() => {
        const now = Date.now();
        const wait = lastReload.current + RELOAD_GAP - now;
        if (wait > 0) {
            if (timer.current === null) {
                timer.current = setTimeout(() => {
                    timer.current = null;
                    lastReload.current = Date.now();
                    router.reload(listReload());
                }, wait);
            }
            return;
        }
        lastReload.current = now;
        router.reload(listReload());
    }, []);

    useEffect(
        () => () => {
            if (timer.current !== null) clearTimeout(timer.current);
        },
        [],
    );

    // Счётчик изменился (событие канала пользователя) — список обновляется без перезагрузки страницы.
    useEffect(() => {
        if (previousUnread.current === unread) return;
        previousUnread.current = unread;
        refreshList();
    }, [unread, refreshList]);

    const open = useCallback((conversationId: string) => {
        setFocusOnOpen(true);
        router.visit(conversationPath(conversationId), paneVisit());
    }, []);

    const activeId = active?.conversation.id ?? null;
    const close = useCallback(() => {
        returnFocusTo.current = activeId;
        router.visit(MESSAGES_PATH, paneVisit());
    }, [activeId]);

    useEffect(() => {
        const id = returnFocusTo.current;
        if (id === null || activeId !== null) return;
        returnFocusTo.current = null;
        rootRef.current
            ?.querySelector<HTMLElement>(`a[href="${conversationPath(id)}"]`)
            ?.focus({ preventScroll: true });
    }, [activeId]);

    const started = useCallback((conversation: ChatConversation) => {
        // Беседа создана первым сообщением: настоящий адрес без шага «черновик» в истории, список — с сервера.
        router.visit(conversationPath(conversation.id), { replace: true, preserveState: false });
    }, []);

    const hasThread = active !== null || compose !== null;

    let thread: ReactNode;
    if (user && (active !== null || compose !== null)) {
        thread = (
            <ChatThread
                key={active ? active.conversation.id : `compose-${compose?.listing.id ?? ''}`}
                viewerId={user.id}
                conversation={active?.conversation ?? null}
                compose={active ? null : compose}
                messages={active?.messages ?? []}
                hasMore={active?.has_more ?? false}
                realtime={props.realtime ?? null}
                focusOnOpen={focusOnOpen}
                onBack={close}
                onChanged={refreshList}
                onStarted={started}
            />
        );
    } else {
        thread = (
            <div className="ym-messages__pick">
                <span className="ym-messages__pick-icon" aria-hidden="true">
                    <Icon name="message-circle" size={40} />
                </span>
                <p className="body ym-messages__pick-text">
                    {conversations.length === 0 ? t.thread.pickEmpty : t.thread.pick}
                </p>
            </div>
        );
    }

    return (
        <div ref={rootRef} className="ym-messages" data-view={hasThread ? 'thread' : 'list'}>
            <h1 className="ym-sr">{t.title}</h1>
            <ConversationList
                conversations={conversations}
                activeId={active?.conversation.id ?? null}
                onOpen={open}
            />
            <section aria-label={t.thread.label} className="ym-messages__thread">
                {thread}
            </section>
        </div>
    );
}

/** Каркас: заголовок вкладки, вкладка «Сообщения» нижней панели. Подвал и шапка — как на других страницах. */
MessagesIndex.layout = (page: ReactNode) => (
    <PublicLayout title={ru.messages.title} tab="messages">
        {page}
    </PublicLayout>
);
