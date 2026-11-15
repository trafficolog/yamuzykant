import { Badge, PriceTag } from '@ds';

import FavoriteToggle from '@/Components/FavoriteToggle';
import { ru } from '@/lang/ru';

export interface UnavailableFavoriteCardProps {
    listingId: string;
    title: string;
    /** BR-11: сумма, `null` — «Договорная», `0` — «Бесплатно». */
    price: number | null;
}

/**
 * Объявление из избранного, которое больше не опубликовано (SPEC §6.1): плашка «Снято с продажи», название и цена,
 * без ссылки на страницу и без фото. Сердце остаётся, чтобы убрать запись из списка.
 */
export default function UnavailableFavoriteCard({
    listingId,
    title,
    price,
}: UnavailableFavoriteCardProps) {
    return (
        <article className="ym-fav-gone">
            <Badge tone="neutral">{ru.lot.status.withdrawn}</Badge>
            <h3 className="body ym-fav-gone__title">{title}</h3>
            <div className="ym-fav-gone__price">
                {price !== null && price > 0 ? (
                    <PriceTag price={price} />
                ) : (
                    <span className="body-l">
                        {price === null ? ru.price.negotiable : ru.price.free}
                    </span>
                )}
            </div>
            <div className="ym-fav-gone__btn">
                <FavoriteToggle listingId={listingId} favorite />
            </div>
        </article>
    );
}
