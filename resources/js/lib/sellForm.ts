import type { Condition } from '@ds';

import type { ListingPhoto } from '@/Components/photoUploaderApi';
import { ru } from '@/lang/ru';

/** Минимум фото (BR-03); совпадает с config/photos.php и PhotoUploader. */
const MIN_PHOTOS = 3;

/** Как задана цена (BR-11): сумма, «Договорная» (суммы нет) или «Бесплатно». */
export type PriceMode = 'amount' | 'negotiable' | 'free';

/** Поля формы, от которых зависит «можно публиковать». */
export interface SellValues {
    title: string;
    condition: Condition | null;
    priceMode: PriceMode;
    /** Целые рубли при priceMode amount; 0 — не указана. */
    price: number;
    meet: boolean;
    ship: boolean;
}

/** Бренд и модель — два слова и больше, как в подсказке и на сервере (StoreListingRequest). */
export function isBrandAndModel(title: string): boolean {
    return /^\S+\s+\S/u.test(title.trim());
}

/**
 * Что ещё нужно добавить, чтобы опубликовать (UC-L1 7a), в порядке макета. Правила те же, что у
 * StoreListingRequest; сервер перепроверяет их и фото по своим данным. Фото с ошибкой не считаются.
 */
export function missingItems(values: SellValues, photos: readonly ListingPhoto[]): string[] {
    const counted = photos.filter((photo) => photo.state !== 'failed');
    const items: string[] = [];

    if (!isBrandAndModel(values.title)) items.push(ru.sell.missing.model);
    if (counted.length < MIN_PHOTOS) items.push(ru.photos.more(MIN_PHOTOS - counted.length));
    if (!counted.some((photo) => photo.is_serial)) items.push(ru.photos.serialMissing);
    if (values.condition === null) items.push(ru.sell.missing.condition);
    if (values.priceMode === 'amount' && values.price <= 0) items.push(ru.sell.missing.price);
    if (!values.meet && !values.ship) items.push(ru.sell.missing.handover);

    return items;
}
