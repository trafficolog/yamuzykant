import { FavoriteButton } from '@ds';

import { useFavorite } from '@/Hooks/useFavorite';
import { ru } from '@/lang/ru';

export interface FavoriteToggleProps {
    listingId: string;
    /** Объявление уже в избранном у зрителя (сервер). */
    favorite: boolean;
}

/**
 * Сердце «В избранное» (UC-S5): FavoriteButton ДС в управляемом режиме. Меняется сразу, при ошибке возвращается,
 * об ошибке сообщает скринридеру через `role="status"`. Гостю открывает вход (useFavorite → openLogin).
 */
export default function FavoriteToggle({ listingId, favorite }: FavoriteToggleProps) {
    const { active, failed, toggle } = useFavorite(listingId, favorite);

    return (
        <>
            <FavoriteButton active={active} onToggle={toggle} />
            <span role="status" className="ym-sr">
                {failed ? ru.favorites.failed : ''}
            </span>
        </>
    );
}
