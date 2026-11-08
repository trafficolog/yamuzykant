import { ru } from '@/lang/ru';

/** Объявление, как его отдаёт ConversationResource (BR-04: только публичные поля). */
export interface ChatListing {
    id: string;
    title: string | null;
    /** BR-11: сумма; `null` — «Договорная», `0` — «Бесплатно». */
    price: number | null;
    /** Объявление опубликовано: пока да, переписка не ограничена окном BR-10. */
    available: boolean;
}

/** Беседа глазами вошедшего. */
export interface ChatConversation {
    id: string;
    /** `buying` — я покупатель, `selling` — я продавец. */
    role: 'buying' | 'selling';
    listing: ChatListing;
    /** Собеседник: только имя; удалившийся аккаунт — `deleted` и имя «Пользователь удалил аккаунт» (BR-09). */
    counterpart: { name: string; deleted: boolean };
    last_message_at: string | null;
    /** Почему писать нельзя (BR-10, текст сервера); `null` — можно. */
    closed_reason: string | null;
}

/** Сообщение (MessageResource и событие `.message.sent`: у события нет `mine` и `read_at`). */
export interface ChatMessage {
    id: number;
    conversation_id: string;
    kind: 'text' | 'system' | 'offer';
    body: string;
    sender_id: number | null;
    created_at: string;
    mine: boolean;
    read_at: string | null;
    /** Ключ идемпотентности отправки (4.1.3): по нему эхо сопоставляется с отправкой, а не по тексту. */
    client_id: string | null;
    /** Подозрительное входящее сообщение: плашка «Будьте осторожны» (у своих сообщений всегда false). */
    caution: boolean;
}

/** Полезная нагрузка `.message.sent`: без «моё» и «прочитано» — их считает клиент. */
export type BroadcastMessage = Omit<ChatMessage, 'mine' | 'read_at'>;

export interface LastMessage {
    body: string;
    mine: boolean;
    kind: ChatMessage['kind'];
    created_at: string;
}

/** Строка списка бесед. */
export interface ConversationListItem extends ChatConversation {
    last_message: LastMessage | null;
    unread: number;
    /** Закрыта для ответов — лежит в «Архиве». */
    closed: boolean;
}

/** Черновик «Написать продавцу»: беседы ещё нет, она появится с первым сообщением. */
export interface ComposeTarget {
    listing: { id: string; title: string | null; price: number | null };
    counterpart: { name: string };
}

/** Максимальная длина сообщения (messaging.max_length, решение OWNER 07.11.2026). */
export const MAX_LENGTH = 2000;

/** Неразрывный пробел: цены и счётчики не переносятся по разрядам и перед «₽». */
const NBSP = String.fromCharCode(0xa0);

/** Число с неразрывными пробелами между разрядами: `1 850`. */
export function groupDigits(value: number): string {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Цена по BR-11: сумма, «Договорная» (`null`), «Бесплатно» (`0`); «0 ₽» не показывается. */
export function formatPrice(price: number | null): string {
    if (price === null) return ru.price.negotiable;
    if (price === 0) return ru.price.free;
    return `${groupDigits(price)}${NBSP}₽`;
}

const ZONE = 'Europe/Moscow';

const dayParts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
});

/** Ключ календарного дня по Москве (AGENTS §4: в отображении Europe/Moscow). */
export function dayKey(iso: string): string {
    return dayParts.format(new Date(iso));
}

const longDay = new Intl.DateTimeFormat('ru-RU', { timeZone: ZONE, day: 'numeric', month: 'long' });
const longDayYear = new Intl.DateTimeFormat('ru-RU', {
    timeZone: ZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

/** Разделитель дат в переписке: «8 сентября», для другого года — с годом. */
export function formatDay(iso: string, now: Date = new Date()): string {
    const date = new Date(iso);
    const sameYear =
        new Intl.DateTimeFormat('ru-RU', { timeZone: ZONE, year: 'numeric' }).format(date) ===
        new Intl.DateTimeFormat('ru-RU', { timeZone: ZONE, year: 'numeric' }).format(now);
    return (sameYear ? longDay : longDayYear).format(date).replace(/\sг\.$/, '');
}

const clock = new Intl.DateTimeFormat('ru-RU', {
    timeZone: ZONE,
    hour: '2-digit',
    minute: '2-digit',
});

/** Время сообщения: «19:08». */
export function formatTime(iso: string): string {
    return clock.format(new Date(iso));
}

const shortDay = new Intl.DateTimeFormat('ru-RU', {
    timeZone: ZONE,
    day: 'numeric',
    month: 'short',
});

/** Дата в строке списка: сегодня — время «19:08», иначе «9 сент.» → «9 сент». */
export function formatListDate(iso: string, now: Date = new Date()): string {
    if (dayKey(iso) === dayKey(now.toISOString())) return formatTime(iso);
    return shortDay.format(new Date(iso)).replace('.', '');
}

/** Инициалы для аватара: первые буквы двух первых слов имени. */
export function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => Array.from(word)[0] ?? '')
        .join('')
        .toUpperCase();
}
