import { ListingCard, type ListingCardProps } from '@ds';
import type { CSSProperties } from 'react';

import { ru } from '@/lang/ru';

export interface FleaListingCardProps extends Omit<ListingCardProps, 'price'> {
    /** BR-11: сумма, `null` — «Договорная», `0` — «Бесплатно». «0 ₽» не показывается. */
    price: number | null;
}

/**
 * ListingCard ДС с ценой по BR-11. Карточка ДС умеет только сумму и для 0 нарисовала бы «0 ₽», поэтому
 * для «Договорная» и «Бесплатно» цена в неё не передаётся: блок цены пуст, а подпись рисует CSS
 * (`.ym-flea__card .ym-price__now:empty::after`, resources/css/flea.css) из `--price-label` на обёртке.
 * Так подпись есть в серверной разметке и без JS. Скринридеры читают сгенерированный текст как видимый.
 * Поддержка `price: null | 0` в ListingCard — запрос в репозиторий ДС; после него обёртка не нужна.
 */
export default function FleaListingCard({ price, ...card }: FleaListingCardProps) {
    const label = price === null ? ru.price.negotiable : price === 0 ? ru.price.free : null;
    const style = label === null ? undefined : ({ '--price-label': `"${label}"` } as CSSProperties);

    return (
        <div className="ym-flea__card" style={style}>
            <ListingCard
                {...card}
                price={label === null ? (price as number) : (undefined as never)}
            />
        </div>
    );
}
