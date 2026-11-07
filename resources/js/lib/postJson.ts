/** Ответ сервера на JSON-запрос: код и тело (пустой объект, если тело не JSON-объект). */
export interface JsonResult {
    status: number;
    body: Record<string, unknown>;
}

/** Значение cookie `XSRF-TOKEN`, которую Laravel выставляет в группе web (в cookie оно URL-кодировано). */
function xsrfToken(): string | null {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * POST JSON с CSRF-токеном сессии (JSON-эндпоинты окна входа). Любой ответ сервера — не исключение:
 * решает вызывающий по `status`. Исключение — только когда ответа нет вовсе (сеть, обрыв).
 */
export async function postJson(url: string, data: Record<string, unknown>): Promise<JsonResult> {
    const token = xsrfToken();
    const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(token ? { 'X-XSRF-TOKEN': token } : {}),
        },
        body: JSON.stringify(data),
    });

    const parsed: unknown = await response.json().catch(() => null);
    const body =
        typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {};

    return { status: response.status, body };
}
