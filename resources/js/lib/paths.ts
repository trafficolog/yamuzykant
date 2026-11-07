/**
 * Адреса страниц, на которые ссылаются другие страницы. Одно место, чтобы Барахолка (3.1.2), лот (3.1.5)
 * и будущие разделы не расходились в написании.
 */

/** Страница объявления (3.1.5). */
export const lotPath = (id: string): string => `/listings/${id}`;

/** Выдача Барахолки (3.1.2); `categoryPath` — путь из слагов (`gitary/elektrogitary`). */
export const fleaPath = (categoryPath?: string | null): string =>
    categoryPath ? `/baraholka/${categoryPath}` : '/baraholka';

/**
 * Адреса разделов кабинета, которых ещё нет: заглушка `#` (DEVIATIONS: «ссылки на ещё не сделанные
 * разделы»). Подставят задачи 2.1.3 (продажа), 2.1.5 (объявления), 4.1.2 (сообщения), 4.3.1 (избранное).
 */
export const HREF_SOON = '#';
