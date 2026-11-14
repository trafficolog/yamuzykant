/** Строка вкладки «Объявления» (MyListingResource): итоговая цена продажи на фронт не приходит. */
export interface MyListing {
    id: string;
    title: string;
    /** BR-11: сумма; `null` — «Договорная», `0` — «Бесплатно». */
    price: number | null;
    negotiable: boolean;
    status: MyListingStatus;
    cover: { square: { webp: string; jpeg?: string } } | null;
    /** Причина модератора дословно: у «Нужны правки» и «Отклонено». */
    return_reason: string | null;
    chats: number;
    views: number;
    url: string;
}

export type MyListingStatus =
    'published' | 'pending' | 'needs_changes' | 'rejected' | 'withdrawn' | 'expired';

/** Фильтр вкладки: группы статусов (MyListings::filter). */
export type MyListingsFilter = 'all' | 'published' | 'review' | 'closed';

export const FILTERS: readonly MyListingsFilter[] = ['all', 'published', 'review', 'closed'];

/**
 * Какие действия показать у объявления. Зеркалит ListingPolicy: сервер всё равно проверит права (403),
 * а состояние машины статусов — единственный источник правды.
 */
export function actionsFor(listing: Pick<MyListing, 'status' | 'price'>): {
    edit: boolean;
    lowerPrice: boolean;
    withdraw: boolean;
    relist: boolean;
    renew: boolean;
} {
    const { status, price } = listing;

    return {
        edit: status === 'published',
        lowerPrice: status === 'published' && price !== null && price > 0,
        withdraw: ['published', 'pending', 'needs_changes', 'expired'].includes(status),
        relist: status === 'withdrawn',
        renew: status === 'expired',
    };
}

/** Продажу «на ЯМузыканте» и итоговую цену сервер принимает только для показанного объявления (UC-L4). */
export const wasShown = (status: MyListingStatus): boolean =>
    status === 'published' || status === 'expired';
