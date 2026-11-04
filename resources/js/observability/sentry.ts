import * as Sentry from '@sentry/react';

type Json = Record<string, unknown>;

/** Событие Sentry в той части, которую мы чистим. */
export interface ScrubbableEvent {
    message?: string;
    user?: Json;
    request?: Json;
    extra?: Json;
    breadcrumbs?: Json[];
    [key: string]: unknown;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const LOGIN_CODE = /\b(code|код|otp)(\W{0,3})\d{4,8}\b/gi;
const SENSITIVE_KEY =
    /(^|[_\-.])(code|otp|pin|authorization|cookie|dsn)([_\-.]|$)|serial|token|password|passwd|secret|api[_-]?key/i;
const SAFE_HEADERS = [
    'x-request-id',
    'user-agent',
    'accept',
    'accept-language',
    'content-type',
    'host',
    'referer',
];
const MASK = '[masked]';

function maskText(text: string): string {
    return text.replace(EMAIL, '[email]').replace(LOGIN_CODE, `$1$2${MASK}`);
}

function maskValue(value: unknown, key?: string): unknown {
    if (
        key !== undefined &&
        SENSITIVE_KEY.test(key) &&
        value !== '' &&
        value !== null &&
        typeof value !== 'object'
    ) {
        return MASK;
    }
    if (typeof value === 'string') {
        return maskText(value);
    }
    if (Array.isArray(value)) {
        return value.map((item) => maskValue(item));
    }
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskValue(v, k)]));
    }
    return value;
}

function scrubRequest(request: Json): Json {
    const clean: Json = {};
    if (typeof request.method === 'string') {
        clean.method = request.method;
    }
    if (typeof request.url === 'string') {
        clean.url = maskText(request.url.split('?')[0] ?? '');
    }
    if (request.headers !== null && typeof request.headers === 'object') {
        clean.headers = Object.fromEntries(
            Object.entries(request.headers).filter(([name]) =>
                SAFE_HEADERS.includes(name.toLowerCase()),
            ),
        );
    }
    // cookies, data, query_string не переносятся.
    return clean;
}

/**
 * beforeSend: убирает из события ПДн (e-mail, IP, куки, тело запроса, код входа). Из пользователя остаётся только id.
 */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
    const scrubbed: ScrubbableEvent = { ...event };

    if (typeof scrubbed.message === 'string') {
        scrubbed.message = maskText(scrubbed.message);
    }
    if (scrubbed.user !== undefined) {
        scrubbed.user = scrubbed.user.id === undefined ? {} : { id: scrubbed.user.id };
    }
    if (scrubbed.request !== undefined) {
        scrubbed.request = scrubRequest(scrubbed.request);
    }
    if (scrubbed.extra !== undefined) {
        scrubbed.extra = maskValue(scrubbed.extra) as Json;
    }
    if (scrubbed.breadcrumbs !== undefined) {
        scrubbed.breadcrumbs = maskValue(scrubbed.breadcrumbs) as Json[];
    }
    for (const key of ['exception', 'contexts', 'tags'] as const) {
        if (scrubbed[key] !== undefined) {
            scrubbed[key] = maskValue(scrubbed[key]);
        }
    }

    return scrubbed as T;
}

export interface SentryInitOptions {
    dsn: string | undefined;
    release: string | undefined;
    environment?: string;
    init?: (options: Sentry.BrowserOptions) => void;
}

/**
 * Включает Sentry в браузере. Без DSN — ничего не делает (CI, локальная разработка).
 */
export function initSentry({
    dsn,
    release,
    environment,
    init = Sentry.init,
}: SentryInitOptions): boolean {
    if (dsn === undefined || dsn === '') {
        return false;
    }

    init({
        dsn,
        release,
        environment,
        beforeSend: scrubEvent as unknown as NonNullable<Sentry.BrowserOptions['beforeSend']>,
    });

    return true;
}
