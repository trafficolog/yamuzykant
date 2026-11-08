import type { Condition } from '@ds';

import type { ListingPhoto } from '@/Components/photoUploaderApi';
import { ru } from '@/lang/ru';

/** Минимум фото (BR-03); совпадает с config/photos.php и PhotoUploader. */
const MIN_PHOTOS = 3;

/** Пределы полей: правила StoreListingRequest (паритет проверяет tests/js/lib/sellLimits.test.ts). */
export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 5000;
export const SERIAL_MAX = 64;
export const YEAR_MIN = 1800;

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

export type LimitedField = 'title' | 'year' | 'serial' | 'description';

/** Ошибки полей с пределами: текст для продавца; поле в пределах — без записи. */
export type FieldErrors = Partial<Record<LimitedField, string>>;

/** Проверка пределов полей на клиенте теми же правилами, что на сервере. Пустые год и серийный номер допустимы. */
export function fieldErrors(values: Record<LimitedField, string>): FieldErrors {
    const errors: FieldErrors = {};
    const yearMax = new Date().getFullYear();

    if (values.title.length > TITLE_MAX) errors.title = ru.sell.limits.title(TITLE_MAX);
    if (values.year !== '') {
        const year = Number(values.year);
        if (values.year.length !== 4 || year < YEAR_MIN || year > yearMax) {
            errors.year = ru.sell.limits.year(YEAR_MIN, yearMax);
        }
    }
    if (values.serial.length > SERIAL_MAX) errors.serial = ru.sell.limits.serial(SERIAL_MAX);
    if (values.description.length > DESCRIPTION_MAX) {
        errors.description = ru.sell.limits.description(DESCRIPTION_MAX);
    }

    return errors;
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
