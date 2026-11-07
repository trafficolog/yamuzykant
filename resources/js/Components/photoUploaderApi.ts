import { ru } from '@/lang/ru';

/** Фото объявления, как его отдаёт ListingPhotoResource. */
export interface ListingPhoto {
    id: number;
    position: number;
    is_serial: boolean;
    state: 'processing' | 'ready' | 'failed';
    error: string | null;
    urls: Record<'square' | 'wide', Record<'avif' | 'webp', string>> | null;
}

/** Подписанный URL загрузки (presigned PUT в S3 или приёмник приложения). */
export interface UploadTicket {
    upload_id: string;
    url: string;
    method: 'PUT';
    headers: Record<string, string>;
    expires_at: string;
}

/** Граница PhotoUploader с сервером: в тестах подменяется целиком. */
export interface PhotoApi {
    list(listingId: string): Promise<ListingPhoto[]>;
    requestUpload(listingId: string, file: File): Promise<UploadTicket>;
    put(ticket: UploadTicket, file: File, onProgress: (percent: number) => void): Promise<void>;
    confirm(listingId: string, uploadId: string, serial: boolean): Promise<ListingPhoto>;
    remove(listingId: string, photoId: number): Promise<ListingPhoto[]>;
    reorder(listingId: string, ids: number[]): Promise<ListingPhoto[]>;
}

/** Ошибка с текстом для продавца (422 сервера). Остальные сбои показываются общим текстом. */
export class PhotoApiError extends Error {}

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
export const MAX_BYTES = 15 * 1024 * 1024;

/** Тип файла: у HEIC браузеры часто не заполняют file.type — смотрим на расширение. */
export function contentTypeOf(file: File): string {
    if (file.type !== '') {
        return file.type;
    }
    const name = file.name.toLowerCase();
    if (name.endsWith('.heic')) return 'image/heic';
    if (name.endsWith('.heif')) return 'image/heif';
    return '';
}

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : '';
}

interface ErrorBody {
    message?: string;
    errors?: Record<string, string[]>;
}

async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrfToken(),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 422) {
        const json = (await response.json()) as ErrorBody;
        const first = Object.values(json.errors ?? {})[0]?.[0];
        throw new PhotoApiError(first ?? json.message ?? ru.photos.errors.network);
    }
    if (!response.ok) {
        throw new Error(String(response.status));
    }

    return (await response.json()) as T;
}

const base = (listingId: string) => `/listings/${encodeURIComponent(listingId)}/photos`;

export const photoApi: PhotoApi = {
    list: (listingId) => request<{ data: ListingPhoto[] }>(base(listingId)).then((r) => r.data),
    requestUpload: (listingId, file) =>
        request<UploadTicket>(`${base(listingId)}/uploads`, 'POST', {
            content_type: contentTypeOf(file),
            size: file.size,
        }),
    put: (ticket, file, onProgress) =>
        new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(ticket.method, ticket.url);
            Object.entries(ticket.headers).forEach(([name, value]) =>
                xhr.setRequestHeader(name, value),
            );
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    onProgress(Math.round((event.loaded / event.total) * 100));
                }
            };
            xhr.onload = () =>
                xhr.status >= 200 && xhr.status < 300
                    ? resolve()
                    : reject(new Error(String(xhr.status)));
            xhr.onerror = () => reject(new Error('network'));
            xhr.send(file);
        }),
    confirm: (listingId, uploadId, serial) =>
        request<{ data: ListingPhoto }>(base(listingId), 'POST', {
            upload_id: uploadId,
            serial,
        }).then((r) => r.data),
    remove: (listingId, photoId) =>
        request<{ data: ListingPhoto[] }>(`${base(listingId)}/${photoId}`, 'DELETE').then(
            (r) => r.data,
        ),
    reorder: (listingId, ids) =>
        request<{ data: ListingPhoto[] }>(`${base(listingId)}/order`, 'PUT', { photos: ids }).then(
            (r) => r.data,
        ),
};
