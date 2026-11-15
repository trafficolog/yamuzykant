import type { ReactNode } from 'react';

import FavoriteToggle from '@/Components/FavoriteToggle';

export interface FavoriteCardFrameProps {
    /** Без `listingId` карточка остаётся как есть (витрина, превью). */
    listingId?: string;
    favorite?: boolean;
    /** У карточки есть фото: сердце рисуется кружком поверх него, как в ListingCard ДС. */
    photo?: boolean;
    children: ReactNode;
}

/**
 * Сердце поверх ListingCard ДС. Сердце самой карточки не сообщает о клике (у FavoriteButton в ней нет `onToggle`),
 * поэтому CSS (`favorites.css`) его скрывает, а на его месте стоит управляемое FavoriteToggle. Правка ListingCard
 * (проп `onFavorite`) — задача в репозитории ДС; после неё этот слой не нужен.
 */
export default function FavoriteCardFrame({
    listingId,
    favorite = false,
    photo = false,
    children,
}: FavoriteCardFrameProps) {
    if (listingId === undefined) return <>{children}</>;

    return (
        <div className={photo ? 'ym-fav-card ym-fav-card--photo' : 'ym-fav-card'}>
            {children}
            <div className="ym-fav-card__btn">
                <FavoriteToggle listingId={listingId} favorite={favorite} />
            </div>
        </div>
    );
}
