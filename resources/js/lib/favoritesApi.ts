import { sendJson } from '@/lib/postJson';

/**
 * Выставляет состояние «в избранном» (PUT / DELETE /listings/{id}/favorite, 4.3.1). Возвращает код ответа:
 * 200 — готово, 401 и 419 — нужен вход, остальное — ошибка. Исключение — только когда ответа нет (сеть).
 */
export async function setFavorite(listingId: string, favorite: boolean): Promise<number> {
    const { status } = await sendJson(
        favorite ? 'PUT' : 'DELETE',
        `/listings/${encodeURIComponent(listingId)}/favorite`,
    );

    return status;
}
