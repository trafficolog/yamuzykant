import { router } from '@inertiajs/react';
import { useSyncExternalStore } from 'react';

/**
 * Итог входа через Яндекс ID для окна (shared prop `login`, flash `login_window`; 1.1.5):
 * явный список полей без почты и yandex_id.
 */
export type LoginOutcome =
    | { status: 'yandex_cancelled'; message: string }
    | { status: 'registration_required'; name: string | null }
    | { status: 'email_required' };

export interface LoginRequest {
    /** Относительный путь, куда вернуться после входа (прерванное действие). */
    returnTo: string;
    /** Элемент, на который вернуть фокус при закрытии; `null` — вернуть на кнопку «Войти» шапки. */
    opener: HTMLElement | null;
    /** Вызывается после входа, когда страница уже обновлена: продолжить прерванное действие. */
    onAuthenticated?: () => void;
    /** Итог Яндекс ID, с которого окно открывается сразу на нужном шаге. */
    outcome?: LoginOutcome | null;
}

/** Страница, на которой стоит пользователь: путь и строка запроса. */
export function currentPath(): string {
    return `${window.location.pathname}${window.location.search}`;
}

/** Управляющие символы и обратный слэш: браузер сводит их к другому адресу, чем видит проверка. */
function hasUnsafeChars(url: string): boolean {
    return Array.from(url).some((char) => {
        const code = char.charCodeAt(0);
        return code <= 0x1f || code === 0x7f || char === '\\';
    });
}

/**
 * Адрес возврата к действию — только относительный путь внутри сайта (как ReturnPath на сервере).
 * Абсолютный адрес своего сайта сводится к пути; чужой хост, `//host`, обратный слэш, `javascript:`,
 * не строка — главная.
 */
export function safeReturnPath(url: string | null | undefined): string {
    if (typeof url !== 'string' || url === '' || hasUnsafeChars(url)) return '/';

    let path = url;
    if (/^https?:\/\//i.test(url)) {
        try {
            const parsed = new URL(url);
            if (parsed.origin !== window.location.origin) return '/';
            path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        } catch {
            return '/';
        }
    }

    // Та же проверка для относительного адреса и для пути из абсолютного: `//host` — чужой хост.
    return path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

let current: LoginRequest | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export function getLoginRequest(): LoginRequest | null {
    return current;
}

/**
 * Открыть окно входа: из шапки, по перехвату 401/419 или после возврата от Яндекса.
 * Если окно уже открыто, второй вызов его не подменяет.
 */
export function openLogin(input: Partial<LoginRequest> = {}): void {
    if (current) return;

    const active = document.activeElement;
    current = {
        returnTo: safeReturnPath(input.returnTo ?? currentPath()),
        opener:
            input.opener !== undefined
                ? input.opener
                : active instanceof HTMLElement && active !== document.body
                  ? active
                  : null,
        onAuthenticated: input.onAuthenticated,
        outcome: input.outcome ?? null,
    };
    emit();
}

export function closeLogin(): void {
    if (!current) return;

    current = null;
    emit();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Текущий запрос окна входа; `null`, пока окно закрыто (и на сервере). */
export function useLoginRequest(): LoginRequest | null {
    return useSyncExternalStore(subscribe, getLoginRequest, () => null);
}

/** Коды ответа, при которых нужен вход: нет сессии (401) или она устарела (419). */
const LOGIN_REQUIRED = [401, 419];

/**
 * Перехват 401 и 419 в переходах Inertia: вместо стандартного показа ответа открывается окно входа.
 * Возврат: прерванный GET-переход ведёт на свой адрес, прочие действия (POST и другие) — на текущую страницу.
 * Возвращает функцию, снимающую слушатель.
 */
export function installLoginInterceptor(): () => void {
    return router.on('invalid', (event) => {
        const response = event.detail.response;
        if (!LOGIN_REQUIRED.includes(response.status)) return;

        event.preventDefault();
        const isGet = String(response.config?.method ?? 'get').toLowerCase() === 'get';
        openLogin({ returnTo: isGet ? safeReturnPath(response.config?.url) : currentPath() });
    });
}
