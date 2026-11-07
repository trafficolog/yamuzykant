import { PriceTag } from '@ds';

import { ru } from '@/lang/ru';

export interface LotPriceProps {
    /** BR-11: сумма; `null` — «Договорная», `0` — «Бесплатно». «0 ₽» не показывается. */
    price: number | null;
}

/**
 * Цена на странице лота (BR-11). PriceTag ДС умеет только сумму, а для 0 нарисовал бы «0 ₽», поэтому
 * «Договорная» и «Бесплатно» собираются из его же классов `ym-price`: вид тот же, текст другой.
 */
export default function LotPrice({ price }: LotPriceProps) {
    if (price !== null && price > 0) return <PriceTag price={price} size="pdp" />;

    return (
        <div className="ym-price ym-price--pdp">
            <div className="ym-price__row">
                <span className="ym-price__now">
                    {price === null ? ru.price.negotiable : ru.price.free}
                </span>
            </div>
        </div>
    );
}
