import { ListingCard, type ListingCardProps } from '@ds';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import FavoriteCardFrame from '@/Components/FavoriteCardFrame';
import { ru } from '@/lang/ru';

export interface LotListingCardProps extends Omit<ListingCardProps, 'price'> {
    /** BR-11: сумма, `null` — «Договорная», `0` — «Бесплатно». «0 ₽» не показывается. */
    price: number | null;
    /** Объявление, к которому относится сердце «В избранное» (4.3.1); без него сердце карточки ДС как есть. */
    listingId?: string;
}

/**
 * ListingCard ДС с ценой по BR-11. Карточка ДС для 0 нарисовала бы «0 ₽», поэтому для «Договорная» и «Бесплатно»
 * цена в неё не передаётся, а подпись кладётся в её блок цены после монтирования (на сервере блок пуст).
 * Правка карточки ДС — задача в репозитории ДС; после неё этот слой не нужен.
 * Сердце «В избранное» — FavoriteCardFrame (с `listingId`).
 */
export default function LotListingCard({
    price,
    listingId,
    favorite,
    ...card
}: LotListingCardProps) {
    const root = useRef<HTMLDivElement>(null);
    const [slot, setSlot] = useState<Element | null>(null);
    const label = price === null ? ru.price.negotiable : price === 0 ? ru.price.free : null;

    useLayoutEffect(() => {
        setSlot(label === null ? null : (root.current?.querySelector('.ym-price__now') ?? null));
    }, [label]);

    return (
        <div ref={root} className="ym-lot__card">
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
            {slot !== null && label !== null ? createPortal(label, slot) : null}
        </div>
    );
}
