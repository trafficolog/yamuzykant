import { ListingCard, type ListingCardProps } from '@ds';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ru } from '@/lang/ru';

export interface LotListingCardProps extends Omit<ListingCardProps, 'price'> {
    /** BR-11: сумма, `null` — «Договорная», `0` — «Бесплатно». «0 ₽» не показывается. */
    price: number | null;
}

/**
 * ListingCard ДС с ценой по BR-11. Карточка ДС для 0 нарисовала бы «0 ₽», поэтому для «Договорная» и «Бесплатно»
 * цена в неё не передаётся, а подпись кладётся в её блок цены после монтирования (на сервере блок пуст).
 * Правка карточки ДС — задача в репозитории ДС; после неё этот слой не нужен.
 */
export default function LotListingCard({ price, ...card }: LotListingCardProps) {
    const root = useRef<HTMLDivElement>(null);
    const [slot, setSlot] = useState<Element | null>(null);
    const label = price === null ? ru.price.negotiable : price === 0 ? ru.price.free : null;

    useLayoutEffect(() => {
        setSlot(label === null ? null : (root.current?.querySelector('.ym-price__now') ?? null));
    }, [label]);

    return (
        <div ref={root} className="ym-lot__card">
            <ListingCard
                {...card}
                price={label === null ? (price as number) : (undefined as never)}
            />
            {slot !== null && label !== null ? createPortal(label, slot) : null}
        </div>
    );
}
