import { router } from '@inertiajs/react';

/**
 * Адреса разделов кабинета, которых ещё нет: заглушка `#` (DEVIATIONS: «ссылки на ещё не сделанные
 * разделы»). Подставят задачи 2.1.3 (продажа), 2.1.5 (объявления), 4.3.1 (избранное).
 */
export const HREF_SOON = '#';

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
 * Страница лота (3.1.5): адреса ещё нет, поэтому карточка объявления в чате — не ссылка. Когда лот появится,
 * задача 3.1.5 подставит сюда его адрес, и карточка станет ссылкой.
 */
export const lotPath = (listingId: string): string => {
    void listingId;
    return HREF_SOON;
};

/**
 * Кнопка «Написать продавцу» (3.1.5): переход на экран сообщений. Гостю сначала окно входа:
 * `useRequireAuth()(() => openWriteToSeller(id), opener)` — после входа чат откроется сразу (1.1.2).
 */
export function openWriteToSeller(listingId: string): void {
    router.visit(writeToSellerPath(listingId));
}
