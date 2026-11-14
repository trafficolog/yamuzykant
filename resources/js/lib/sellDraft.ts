/** Поля формы, которые уходят в черновик (PUT /sell/draft, SaveDraftRequest): неполная форма допустима. */
export interface DraftPayload {
    listing_id: string;
    category_id: number | null;
    title: string | null;
    model_id: number | null;
    year: number | null;
    /** Нет ключа — серийный номер на сервере не меняется (форма не получает его целиком). */
    serial?: string | null;
    condition: string | null;
    description: string | null;
    price_mode: string;
    price: number | null;
    negotiable: boolean;
    meet: boolean;
    ship: boolean;
}

/** Результат сохранения: время сервера или текст отказа (null — общий сбой сети или сервера). */
export type DraftSaveResult =
    { ok: true; savedAt: string | null } | { ok: false; message: string | null };

function xsrfToken(): string | null {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);

    return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * Сохраняет черновик. `keepalive` — при уходе со страницы: запрос доживает до ответа, даже если вкладку закрыли.
 * Любой ответ сервера — не исключение: 422 даёт текст первой ошибки, остальное — общий сбой.
 */
export async function saveDraft(
    payload: DraftPayload,
    keepalive = false,
): Promise<DraftSaveResult> {
    const token = xsrfToken();

    try {
        const response = await fetch('/sell/draft', {
            method: 'PUT',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                ...(token ? { 'X-XSRF-TOKEN': token } : {}),
            },
            body: JSON.stringify(payload),
            ...(keepalive ? { keepalive: true } : {}),
        });

        if (response.ok) {
            const json = (await response.json().catch(() => null)) as {
                saved_at?: string;
            } | null;

            return { ok: true, savedAt: json?.saved_at ?? null };
        }

        if (response.status === 422) {
            const json = (await response.json().catch(() => null)) as {
                errors?: Record<string, string[]>;
            } | null;

            return { ok: false, message: Object.values(json?.errors ?? {})[0]?.[0] ?? null };
        }

        return { ok: false, message: null };
    } catch {
        return { ok: false, message: null };
    }
}
