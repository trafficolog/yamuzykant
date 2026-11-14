import { Button, FilterChip, Icon, SearchBar } from '@ds';
import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type FormEvent,
    type KeyboardEvent,
    type MouseEvent,
} from 'react';

import { ru } from '@/lang/ru';
import { formatListDate, groupDigits, type ConversationListItem } from '@/lib/messages';
import { conversationPath } from '@/lib/paths';

type Filter = 'all' | 'buying' | 'selling';

const FILTERS: readonly Filter[] = ['all', 'buying', 'selling'];

export interface ConversationListProps {
    conversations: readonly ConversationListItem[];
    /** Открытая беседа: её строка помечена `aria-current`. */
    activeId: string | null;
    onOpen: (conversationId: string) => void;
}

const t = ru.messages.list;

const SEARCH_ID = 'ym-messages-search';

const matches = (item: ConversationListItem, query: string): boolean =>
    [item.counterpart.name, item.listing.title ?? '', item.last_message?.body ?? ''].some((part) =>
        part.toLowerCase().includes(query),
    );

/** Обычный левый клик без модификаторов открывает беседу на месте; остальное — как у любой ссылки. */
const isPlainClick = (event: MouseEvent): boolean =>
    event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/**
 * Список бесед (4.1.2): фильтр «Все / Покупаю / Продаю» с количеством, поиск по чатам, строки со счётчиком
 * непрочитанных. Беседы открыты всегда (BR-10, 4.1.5): архива и пометки «Только чтение» нет. Строка — ссылка
 * (открывается в новой вкладке, работает без JS).
 */
export default function ConversationList({
    conversations,
    activeId,
    onOpen,
}: ConversationListProps) {
    const [filter, setFilter] = useState<Filter>('all');
    const [searching, setSearching] = useState(false);
    const [query, setQuery] = useState('');
    const headRef = useRef<HTMLDivElement>(null);
    const groupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (searching) document.getElementById(SEARCH_ID)?.focus();
    }, [searching]);

    const counts = useMemo(
        () =>
            ({
                all: conversations.length,
                buying: conversations.filter((item) => item.role === 'buying').length,
                selling: conversations.filter((item) => item.role === 'selling').length,
            }) satisfies Record<Filter, number>,
        [conversations],
    );

    const needle = searching ? query.trim().toLowerCase() : '';
    const visible = useMemo(() => {
        if (needle !== '') return conversations.filter((item) => matches(item, needle));
        return conversations.filter((item) => filter === 'all' || item.role === filter);
    }, [conversations, filter, needle]);

    const closeSearch = () => {
        setSearching(false);
        setQuery('');
        headRef.current?.querySelector<HTMLElement>('button')?.focus();
    };

    const onFilterKey = (event: KeyboardEvent<HTMLDivElement>) => {
        const step =
            event.key === 'ArrowRight' || event.key === 'ArrowDown'
                ? 1
                : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                  ? -1
                  : 0;
        if (step === 0) return;
        event.preventDefault();
        const next = FILTERS[(FILTERS.indexOf(filter) + step + FILTERS.length) % FILTERS.length];
        if (next === undefined) return;
        setFilter(next);
        // Фокус следует за выбором (roving tabindex): ждём, пока чип станет tabindex=0.
        requestAnimationFrame(() =>
            groupRef.current
                ?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
                ?.focus(),
        );
    };

    const emptyText =
        needle !== '' ? t.searchEmpty : conversations.length === 0 ? t.emptyAll : t.emptySection;

    return (
        <section aria-label={t.label} className="ym-messages__list">
            <div ref={headRef} className="ym-messages__list-head">
                <h2 className="h3 ym-messages__list-title">{ru.messages.title}</h2>
                <Button
                    variant="ghost"
                    icon="search"
                    aria-label={t.searchToggle}
                    aria-expanded={searching}
                    onClick={() => (searching ? closeSearch() : setSearching(true))}
                />
            </div>

            {searching ? (
                // SearchBar ДС не отдаёт ввод наружу (только onSearch по отправке): живой отбор — через всплытие change.
                // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                <div
                    className="ym-messages__search"
                    onChange={(event: FormEvent<HTMLDivElement>) =>
                        setQuery((event.target as HTMLInputElement).value)
                    }
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            closeSearch();
                        }
                    }}
                >
                    <SearchBar
                        id={SEARCH_ID}
                        placeholder={t.searchPlaceholder}
                        onSearch={setQuery}
                    />
                </div>
            ) : null}

            {/* Стрелки обрабатываются здесь, а фокус держат сами чипы (roving tabindex ДС): делегирование событий. */}
            {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
            <div
                ref={groupRef}
                role="radiogroup"
                aria-label={t.filterLabel}
                className="ym-messages__filters"
                onKeyDown={onFilterKey}
            >
                {FILTERS.map((key) => (
                    <FilterChip
                        key={key}
                        radio
                        selected={filter === key}
                        count={counts[key]}
                        onChange={() => {
                            setFilter(key);
                            if (searching) closeSearch();
                        }}
                    >
                        {t[key]}
                    </FilterChip>
                ))}
            </div>

            {visible.length === 0 ? (
                <div className="ym-messages__empty">
                    <p className="body-s ym-messages__empty-text">{emptyText}</p>
                    {needle === '' && conversations.length === 0 ? (
                        <p className="body-s ym-messages__empty-hint">{t.emptyAllHint}</p>
                    ) : null}
                </div>
            ) : (
                <ul aria-label={t.chats} className="ym-messages__rows">
                    {visible.map((item) => (
                        <ConversationRow
                            key={item.id}
                            item={item}
                            current={item.id === activeId}
                            onOpen={onOpen}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}

function ConversationRow({
    item,
    current,
    onOpen,
}: {
    item: ConversationListItem;
    current: boolean;
    onOpen: (conversationId: string) => void;
}) {
    const last = item.last_message;
    const role = item.role === 'buying' ? t.roleSeller : t.roleBuyer;
    const preview = last ? `${last.mine ? t.you : ''}${last.body.replace(/\s+/g, ' ').trim()}` : '';

    return (
        <li className="ym-messages__item">
            <a
                href={conversationPath(item.id)}
                className="ym-messages__row"
                aria-current={current ? 'true' : undefined}
                onClick={(event) => {
                    if (!isPlainClick(event)) return;
                    event.preventDefault();
                    onOpen(item.id);
                }}
            >
                <span className="ym-messages__thumb" aria-hidden="true">
                    <Icon name="guitar" size={28} />
                    <span className="ym-messages__role" title={role}>
                        <Icon name={item.role === 'buying' ? 'store' : 'user'} size={14} />
                    </span>
                </span>
                <span className="ym-messages__body">
                    <span className="ym-messages__line">
                        <span className="body ym-messages__name">{item.counterpart.name}</span>
                        {last ? (
                            <time
                                className="caption ym-messages__date"
                                dateTime={last.created_at}
                                data-dynamic
                            >
                                {formatListDate(last.created_at)}
                            </time>
                        ) : null}
                    </span>
                    <span className="body-s ym-messages__subject">{item.listing.title}</span>
                    <span className="ym-messages__line">
                        <span className="body-s ym-messages__preview">{preview}</span>
                        {item.unread > 0 ? (
                            <span className="ym-messages__badge" aria-hidden="true">
                                {item.unread > 99 ? `99+` : groupDigits(item.unread)}
                            </span>
                        ) : null}
                    </span>
                </span>
                <span className="ym-sr">{role}</span>
                {item.unread > 0 ? (
                    <>
                        {' '}
                        <span className="ym-sr">{t.unread(item.unread)}</span>
                    </>
                ) : null}
            </a>
        </li>
    );
}
