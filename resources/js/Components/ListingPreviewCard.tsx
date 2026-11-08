import { ListingCard } from '@ds';
import type { ListingCardProps } from '@ds';
import { useLayoutEffect, useRef } from 'react';

interface ListingPreviewCardProps extends ListingCardProps {
    /** Вместо цены: «Договорная», «Бесплатно» (SPEC BR-11 — «0 ₽» не показываем никогда). */
    priceLabel?: string | null;
}

/**
 * ListingCard ДС с подписью вместо цены. Карточка ДС умеет показывать только сумму (`rub(price)`), поэтому
 * подпись ставится в её блок цены после отрисовки; при смене режима карточка пересоздаётся (key), и React
 * не теряет свой текстовый узел. Нужна поддержка в самой ДС — задача на изменение ДС (AGENTS §6).
 */
export default function ListingPreviewCard({ priceLabel, ...card }: ListingPreviewCardProps) {
    const root = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const price = root.current?.querySelector('.ym-price__now');
        if (price && priceLabel) price.textContent = priceLabel;
    });

    return (
        <div ref={root}>
            <ListingCard key={priceLabel ? 'label' : 'amount'} {...card} />
        </div>
    );
}
