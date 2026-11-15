import { router } from '@inertiajs/react';

/**
 * Адреса страниц, на которые ссылаются другие страницы. Одно место, чтобы Барахолка (3.1.2), лот (3.1.5)
 * и будущие разделы не расходились в написании.
 */

/** Страница объявления (3.1.5). */
export const lotPath = (id: string): string => `/listings/${id}`;

/** Страница продавца (3.1.6); вкладка «Продано» — `?tab=sold`, страница списка — `page`. */
export const sellerPath = (id: number, query: { tab?: 'sold'; page?: number } = {}): string => {
    const params = new URLSearchParams();
    if (query.tab !== undefined) params.set('tab', query.tab);
    if (query.page !== undefined && query.page > 1) params.set('page', String(query.page));
    const search = params.toString();
    return search === '' ? `/sellers/${id}` : `/sellers/${id}?${search}`;
};

/** Выдача Барахолки (3.1.2); `categoryPath` — путь из слагов (`gitary/elektrogitary`). */
export const fleaPath = (categoryPath?: string | null): string =>
    categoryPath ? `/baraholka/${categoryPath}` : '/baraholka';

/**
 * Адреса разделов кабинета, которых ещё нет: заглушка `#` (DEVIATIONS: «ссылки на ещё не сделанные
 * разделы»). Подставят задачи 4.3.1 (избранное) и 4.2.x (уведомления).
 */
export const HREF_SOON = '#';

/** Кабинет (1.1.3): «Обзор» и «Профиль». */
export const ACCOUNT_PATH = '/account';
export const PROFILE_PATH = '/account/profile';

/** «Объявления» кабинета (2.1.5). */
export const LISTINGS_PATH = '/account/listings';

/** Экран сообщений (4.1.2): шапка, меню кабинета, вкладка нижней панели. */
export const MESSAGES_PATH = '/messages';

/** Открытая беседа. */
export const conversationPath = (conversationId: string): string =>
    `${MESSAGES_PATH}/${encodeURIComponent(conversationId)}`;

/**
 * «Написать продавцу» по объявлению: сервер откроет существующую беседу или черновик, беседа создаётся первым
 * сообщением. Адрес — для ссылок и `router.visit`; кнопку на странице лота (3.1.5) делает `openWriteToSeller`.
 */
export const writeToSellerPath = (listingId: string): string =>
    `${MESSAGES_PATH}?listing=${encodeURIComponent(listingId)}`;

/**
 * Кнопка «Написать продавцу» (3.1.5): переход на экран сообщений. Гостю сначала окно входа:
 * `useRequireAuth()(() => openWriteToSeller(id), opener)` — после входа чат откроется сразу (1.1.2).
 */
export function openWriteToSeller(listingId: string): void {
    router.visit(writeToSellerPath(listingId));
}

/** Форма «Продать инструмент» (2.1.3). Гостю после входа открывается она же. */
export const SELL_PATH = '/sell';
