import { ListingCard, type ListingCardProps } from '@ds';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ru } from '@/lang/ru';

export interface FleaListingCardProps extends Omit<ListingCardProps, 'price'> {
    /** BR-11: сумма, `null` — «Договорная», `0` — «Бесплатно». «0 ₽» не показывается. */
    price: number | null;
}

/**
 * ListingCard ДС с ценой по BR-11. Карточка ДС умеет только сумму и для 0 нарисовала бы «0 ₽»,
 * поэтому для «Договорная» и «Бесплатно» цена в неё не передаётся, а подпись кладётся в её блок цены.
 * Правка карточки ДС — в репозитории ДС; до неё подпись появляется после монтирования (на сервере блок цены пуст).
 */
export default function FleaListingCard({ price, ...card }: FleaListingCardProps) {
    const root = useRef<HTMLDivElement>(null);
    const [slot, setSlot] = useState<Element | null>(null);
    const label = price === null ? ru.price.negotiable : price === 0 ? ru.price.free : null;

    useLayoutEffect(() => {
        setSlot(label === null ? null : (root.current?.querySelector('.ym-price__now') ?? null));
    }, [label]);

    return (
        <div ref={root} className="ym-flea__card">
            <ListingCard
                {...card}
                price={label === null ? (price as number) : (undefined as never)}
            />
            {slot !== null && label !== null ? createPortal(label, slot) : null}
        </div>
    );
}
