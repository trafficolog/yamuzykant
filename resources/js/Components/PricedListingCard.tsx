import { ListingCard, type ListingCardProps } from '@ds';
import type { CSSProperties } from 'react';

import FavoriteCardFrame from '@/Components/FavoriteCardFrame';
import { ru } from '@/lang/ru';

export interface PricedListingCardProps extends Omit<ListingCardProps, 'price'> {
    /** BR-11: сумма, `null` — «Договорная», `0` — «Бесплатно». «0 ₽» не показывается. */
    price: number | null;
    /** Объявление, к которому относится сердце «В избранное» (4.3.1); без него сердце карточки ДС как есть. */
    listingId?: string;
}

/**
 * ListingCard ДС с ценой по BR-11 для карточек Барахолки и лота. Карточка ДС умеет только сумму и для 0
 * нарисовала бы «0 ₽», поэтому для «Договорная» и «Бесплатно» цена в неё не передаётся: блок цены пуст,
 * слово лежит текстом рядом (`ym-sr`: видно в серверной разметке, Ctrl+F, скринридерам), а на экране его
 * рисует CSS из `--price-label` (`.ym-priced-card .ym-price__now:empty::after`, resources/css/site.css).
 * Поддержка `price: null | 0` в ListingCard — запрос в репозиторий ДС; после него обёртка не нужна.
 * Сердце «В избранное» — FavoriteCardFrame (с `listingId`).
 */
export default function PricedListingCard({
    price,
    listingId,
    favorite,
    ...card
}: PricedListingCardProps) {
    const label = price === null ? ru.price.negotiable : price === 0 ? ru.price.free : null;
    const style = label === null ? undefined : ({ '--price-label': `"${label}"` } as CSSProperties);

    return (
        <div className="ym-priced-card" style={style}>
            <FavoriteCardFrame
                listingId={listingId}
                favorite={favorite}
                photo={card.image !== undefined}
            >
                <ListingCard
                    {...card}
                    favorite={favorite}
                    price={label === null ? (price as number) : (undefined as never)}
                />
            </FavoriteCardFrame>
            {label === null ? null : <span className="ym-sr">{label}</span>}
        </div>
    );
}
